import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';
import { CourseModules, ModuleUnlockRecord, ModuleUnlocksApi } from '../../../shared/common-services/module-unlocks.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { UsersService } from '../../../shared/common-services/users.service';

/**
 * Unlock Module: modules open one after another (lessons done and the module's quizzes passed). Here a mentor opens a
 * locked module early for one student of their batch, with a reason that is recorded; the unlock can be taken back.
 */
@Component({
  selector: 'app-unlock-module',
  standalone: true,
  templateUrl: './unlock-module.html',
  styleUrls: ['../mentor.scss'],
})
export class UnlockModule implements OnInit {
  private readonly api = inject(ModuleUnlocksApi);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);

  /** The mentor's assigned students (the API limits the list to them). */
  readonly students = computed(() => this.users.students().filter(u => u.st !== 'Suspended'));

  readonly studentId = signal('');
  readonly overview = signal<CourseModules[]>([]);
  readonly history = signal<ModuleUnlockRecord[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  /** The module whose "Unlock" is open for a reason, and the reason being typed. */
  readonly target = signal<number | null>(null);
  readonly reason = signal('');

  readonly student = computed(() => this.students().find(s => s.id === this.studentId()));

  /** An unlock record for a chapter of the picked student, so a row can offer to take it back. */
  private readonly unlockByChapter = computed(() => new Map(this.history().filter(h => h.student_id === this.studentId()).map(h => [h.chapter_id, h])));

  ngOnInit(): void {
    void this.users.refresh();
    void this.loadHistory();
  }

  async pick(id: string): Promise<void> {
    this.studentId.set(id);
    this.target.set(null);
    this.overview.set([]);
    if (!id) return;
    await this.loadOverview();
  }

  private async loadOverview(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.overview.set(await this.api.overview(this.studentId()));
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadHistory(): Promise<void> {
    try { this.history.set(await this.api.list()); } catch { /* the history is a convenience */ }
  }

  openUnlock(chapterId: number): void {
    this.target.set(chapterId);
    this.reason.set('');
  }

  recordFor(chapterId: number): ModuleUnlockRecord | undefined { return this.unlockByChapter().get(chapterId); }

  async confirm(chapterId: number, moduleName: string): Promise<void> {
    const reason = this.reason().trim();
    if (reason.length < 5) return void this.toast.error('Give the reason', 'Write a few words on why this student needs the module early.');
    this.busy.set(true);
    try {
      await this.api.create({ student_id: this.studentId(), chapter_id: chapterId, reason });
      this.log.record('Learning Management', `Unlocked “${moduleName}” early for ${this.student()?.n} — ${reason}`);
      this.toast.success('Module unlocked', 'The override is recorded against your name and the student is told.');
      this.target.set(null);
      await Promise.all([this.loadOverview(), this.loadHistory()]);
    } catch (e) {
      this.toast.error('Could not unlock the module', apiErrorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async revoke(record: ModuleUnlockRecord): Promise<void> {
    if (!(await this.toast.confirm('Take the unlock back?', `“${record.module}” locks again for ${record.name} unless they have earned it.`, 'Yes, lock it'))) return;
    try {
      await this.api.remove(record.id);
      this.toast.success('Unlock removed');
      await Promise.all([this.studentId() ? this.loadOverview() : Promise.resolve(), this.loadHistory()]);
    } catch (e) {
      this.toast.error('Could not remove the unlock', apiErrorMessage(e));
    }
  }
}
