import { NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';
import { BatchEnrollmentsService } from '../../../shared/common-services/batch-enrollments.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { CountRibbon } from '../../../shared/components/count-ribbon/count-ribbon';
import { EnrollmentDetail, EnrollmentStudent } from '../../../shared/models/batch-enrollment.model';
import { DetailCardData } from '../../../shared/models/common-components.model';
import { downloadCsv } from '../../../shared/utils/csv-download.util';
import { EnrollmentTimeline } from '../enrollment-timeline/enrollment-timeline';

const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

/** One enrollment in full: how every student is doing, the mentors, certificates and the history of this course for the batch. */
@Component({
  selector: 'app-enrollment-detail',
  standalone: true,
  imports: [NgClass, CountRibbon, EnrollmentTimeline],
  templateUrl: './enrollment-detail.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', './enrollment-detail.scss'],
})
export class EnrollmentDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(BatchEnrollmentsService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);

  readonly canEdit = inject(AuthService).can('a_enroll', 'u');
  readonly detail = signal<EnrollmentDetail | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly query = signal('');

  private get id(): string { return this.route.snapshot.paramMap.get('id') ?? ''; }

  readonly students = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.detail()?.students ?? [];
    return q ? all.filter(s => [s.name, s.id, s.org].some(v => v.toLowerCase().includes(q))) : all;
  });

  readonly tiles = computed<DetailCardData[]>(() => {
    const s = this.detail()?.summary;
    if (!s) return [];
    return [
      { label: 'Students', value: s.students, icon: 'bi-mortarboard-fill', iconVariant: 'blue' },
      { label: 'Completed', value: `${s.completed} of ${s.students}`, icon: 'bi-check-circle-fill', iconVariant: 'green' },
      { label: 'Average progress', value: `${s.avgProgress}%`, icon: 'bi-graph-up-arrow', iconVariant: 'purple' },
      { label: 'Attendance', value: pct(s.avgAttendance), icon: 'bi-calendar-check', iconVariant: 'orange' },
      { label: 'Quiz average', value: pct(s.avgQuiz), icon: 'bi-patch-question', iconVariant: 'blue' },
      { label: 'Certificates', value: `${s.certificatesIssued} issued · ${s.certificatesPending} pending`, icon: 'bi-award', iconVariant: 'green' },
    ];
  });

  /** Students who finished the course and still have no certificate, so "Generate" has something to do. */
  readonly awaitingCertificate = computed(() => (this.detail()?.students ?? []).filter(s => s.progress >= 100 && !s.certificate).length);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.detail.set(await this.store.detail(this.id));
      this.error.set(null);
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    }
  }

  async generate(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const made = await this.store.generateCertificates(this.id);
      this.toast.success(made ? 'Certificates generated' : 'Nothing to generate', made ? `${made} certificate(s) are pending approval.` : 'Every finished student already has a certificate.');
      await this.load();
    } catch (e) {
      this.toast.error('Could not generate certificates', apiErrorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async decide(s: EnrollmentStudent, issue: boolean): Promise<void> {
    if (!s.certificate || this.busy()) return;
    this.busy.set(true);
    try {
      const res = issue ? await this.store.issueCertificate(s.certificate.id) : await this.store.rejectCertificate(s.certificate.id);
      this.log.record('Enrollment', `${issue ? 'Issued' : 'Rejected'} the certificate of ${s.name} for ${this.detail()?.enrollment.course}`);
      this.toast.success(issue ? `Certificate issued (${res.number})` : 'Certificate rejected');
      await this.load();
    } catch (e) {
      this.toast.error('Could not update the certificate', apiErrorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  exportCsv(): void {
    const d = this.detail();
    if (!d) return;
    downloadCsv(`${d.enrollment.course}-${d.enrollment.batch}`.replace(/\s+/g, '-').toLowerCase(),
      ['Student ID', 'Name', 'Institute', 'Progress %', 'Lessons done', 'Attendance %', 'Quiz avg %', 'Last accessed', 'Certificate', 'Certificate no.'],
      this.students().map(s => [s.id, s.name, s.org, s.progress, s.lessonsDone, s.attendance ?? '', s.quiz ?? '', s.lastAccessed, s.certificate?.status ?? '', s.certificate?.number ?? '']));
  }

  back(): void {
    void this.router.navigateByUrl('/app/enrollment');
  }
}
