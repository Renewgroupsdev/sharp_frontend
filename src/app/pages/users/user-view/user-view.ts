import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ROLE_ACCESS } from '../../../core/data/models';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { AttendanceService } from '../../../shared/common-services/attendance.service';
import { AuditEntry, AuditLogsApi } from '../../../shared/common-services/audit-logs-api.service';
import { BatchesService } from '../../../shared/common-services/batches.service';
import { CertificatesApi } from '../../../shared/common-services/certificates-api.service';
import { LearningApi, LearningApiResource } from '../../../shared/common-services/learning-api.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { UserActionsService } from '../../../shared/common-services/user-actions.service';
import { UsersService } from '../../../shared/common-services/users.service';
import { CanActionDirective } from '../../../shared/directives/can-action.directive';
import { AttendanceRecord } from '../../../shared/models/attendance.model';
import { Certificate } from '../../../shared/models/certificate.model';
import { CertQrCard, qrStatusLabel, withQrImages } from '../../../shared/utils/certificate-qr.util';
import { learningStatusOf } from '../../../shared/common-services/learning.service';
import { ModuleProgress } from '../../../shared/models/learning.model';
import { BATCH_ROLES } from '../../../shared/models/user.model';

type TabKey = 'details' | 'biography' | 'learning' | 'attendance' | 'certificates' | 'logs' | 'account';

interface Course extends LearningApiResource { status: string }

/**
 * Profile of a user in a wide side panel. Tabs: Details (with the biography for everyone but students), and for students
 * their learning progress per course, attendance and certificates; then the activity log and the account actions.
 * Each tab loads its data the first time it is opened. Closes with `'edit'` when the Edit button is used.
 */
@Component({
  selector: 'app-user-view',
  standalone: true,
  imports: [CommonModule, MatDialogModule, CanActionDirective],
  templateUrl: './user-view.html',
  styleUrls: ['./user-view.scss'],
})
export class UserView {
  private readonly dialogRef = inject(MatDialogRef<UserView, 'edit'>);
  private readonly data = inject<{ userId: string }>(MAT_DIALOG_DATA);
  private readonly users = inject(UsersService);
  private readonly batches = inject(BatchesService);
  private readonly actions = inject(UserActionsService);
  private readonly learningApi = inject(LearningApi);
  private readonly attendanceStore = inject(AttendanceService);
  private readonly certificatesApi = inject(CertificatesApi);
  private readonly auditApi = inject(AuditLogsApi);
  private readonly toast = inject(ToastService);

  readonly tab = signal<TabKey>('details');
  readonly user = computed(() => this.users.get(this.data.userId));
  readonly isStudent = computed(() => this.user()?.r === 'Student');
  readonly access = computed(() => ROLE_ACCESS[this.user()?.r as keyof typeof ROLE_ACCESS] ?? '');
  readonly canChangeBatch = computed(() => BATCH_ROLES.includes(this.user()?.r ?? ''));
  readonly batchNames = computed(() => this.batches.names());

  /** The ribbon: students get learning, attendance and certificates; everyone gets the activity log. */
  readonly tabs = computed<{ key: TabKey; label: string; icon: string }[]>(() => [
    { key: 'details', label: 'Details', icon: 'bi-person-vcard' },
    ...(this.isStudent() ? [] : [{ key: 'biography' as const, label: 'Biography', icon: 'bi-journal-text' }]),
    ...(this.isStudent() ? [
      { key: 'learning' as const, label: 'Learning', icon: 'bi-play-circle' },
      { key: 'attendance' as const, label: 'Attendance', icon: 'bi-calendar-check' },
      { key: 'certificates' as const, label: 'Certificates', icon: 'bi-award' },
    ] : []),
    { key: 'logs', label: 'Activity logs', icon: 'bi-list-check' },
  ]);

  readonly courses = signal<Course[]>([]);
  readonly records = signal<AttendanceRecord[]>([]);
  readonly certs = signal<Certificate[]>([]);
  /** The student's certificate QR codes, one per enrolled course. */
  readonly qrCards = signal<CertQrCard[]>([]);
  protected readonly qrLabel = qrStatusLabel;
  protected qrTone(c: CertQrCard): string { return c.status === 'issued' ? 'ok' : c.status === 'completed' ? 'ok' : c.status === 'in_progress' ? 'wait' : 'bad'; }
  readonly logs = signal<AuditEntry[]>([]);
  readonly busy = signal<Partial<Record<TabKey, boolean>>>({});
  private readonly loaded = new Set<TabKey>();

  readonly attendanceStats = computed(() => {
    const rows = this.records();
    const present = rows.filter(r => r.status === 'Present').length;
    return { total: rows.length, present, absent: rows.length - present, rate: rows.length ? Math.round((present / rows.length) * 100) : 0 };
  });
  readonly courseDone = computed(() => this.courses().filter(c => c.progress >= 100).length);
  readonly learningAvg = computed(() => {
    const c = this.courses();
    return c.length ? Math.round(c.reduce((s, x) => s + x.progress, 0) / c.length) : 0;
  });

  /** Course rows opened to show their modules, and the modules once loaded. */
  readonly openCourse = signal<number | null>(null);
  readonly modules = signal<Record<number, ModuleProgress[] | 'loading'>>({});

  constructor() {
    effect(() => {
      const tab = this.tab();
      if (this.user()) untracked(() => void this.ensure(tab));
    });
  }

  private async ensure(tab: TabKey): Promise<void> {
    if (this.loaded.has(tab) || !['learning', 'attendance', 'certificates', 'logs'].includes(tab)) return;
    this.loaded.add(tab);
    const sid = this.data.userId;
    this.busy.update(b => ({ ...b, [tab]: true }));
    try {
      if (tab === 'learning') {
        this.courses.set((await this.learningApi.list({ q: sid })).filter(r => r.student_id === sid).map(r => ({ ...r, status: learningStatusOf(r.progress) })));
      } else if (tab === 'attendance') {
        const from = new Date(Date.now() - 180 * 86_400_000).toLocaleDateString('en-CA');
        this.records.set((await this.attendanceStore.fetch({ student_id: sid, date_from: from })).sort((a, b) => b.iso.localeCompare(a.iso)));
      } else if (tab === 'certificates') {
        const [certs, codes] = await Promise.all([this.certificatesApi.list({ q: sid }), this.certificatesApi.studentQrCodes(sid)]);
        this.certs.set(certs.filter(c => c.student_id === sid));
        this.qrCards.set(await withQrImages(codes));
      } else {
        this.logs.set(await this.auditApi.forUser(sid));
      }
    } catch (e) {
      this.loaded.delete(tab);
      this.toast.error('Could not load this tab', apiErrorMessage(e));
    } finally {
      this.busy.update(b => ({ ...b, [tab]: false }));
    }
  }

  async toggleModules(course: Course): Promise<void> {
    if (this.openCourse() === course.course_id) return void this.openCourse.set(null);
    this.openCourse.set(course.course_id);
    if (this.modules()[course.course_id]) return;
    this.modules.update(m => ({ ...m, [course.course_id]: 'loading' }));
    try {
      const rows = await this.learningApi.moduleReport(course.student_id, course.course_id);
      this.modules.update(m => ({ ...m, [course.course_id]: rows.map(r => ({ ...r, status: learningStatusOf(r.pct) })) }));
    } catch (e) {
      this.modules.update(m => ({ ...m, [course.course_id]: [] }));
      this.toast.error('Could not load the modules', apiErrorMessage(e));
    }
  }

  modulesOf(courseId: number): ModuleProgress[] | 'loading' | undefined { return this.modules()[courseId]; }

  ago(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  edit(): void { this.dialogRef.close('edit'); }
  close(): void { this.dialogRef.close(); }

  resendInvite(): void { this.actions.resendInvite(this.data.userId); }
  resetPassword(): void { void this.actions.resetPassword(this.data.userId); }
  toggleStatus(): void { void this.actions.toggleStatus(this.data.userId); }
  changeBatch(batch: string): void { this.actions.changeBatch(this.data.userId, batch); }

  async remove(): Promise<void> {
    if (await this.actions.remove(this.data.userId)) this.close();
  }
}
