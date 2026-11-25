import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';
import { BatchEnrollmentsService } from '../../../shared/common-services/batch-enrollments.service';
import { BatchesService } from '../../../shared/common-services/batches.service';
import { ToastService } from '../../../shared/common-services/toast.service';

/** Copy the courses of the selected enrollments to other batches. */
@Component({
  selector: 'app-enrollment-copy',
  standalone: true,
  imports: [MatDialogModule],
  templateUrl: './enrollment-copy.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class EnrollmentCopy {
  private readonly ref = inject(MatDialogRef<EnrollmentCopy, boolean>);
  private readonly data = inject<{ ids: string[] }>(MAT_DIALOG_DATA);
  private readonly store = inject(BatchEnrollmentsService);
  private readonly batchStore = inject(BatchesService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);

  /** The distinct courses behind the selection. */
  readonly courses = [...new Set(this.store.items().filter(e => this.data.ids.includes(e.id)).map(e => e.course))];
  readonly picked = signal<number[]>([]);
  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly batches = computed(() => this.batchStore.items().filter(b => /^\d+$/.test(b.id)).map(b => ({ id: Number(b.id), name: b.n, students: this.batchStore.studentCount(b) })));

  toggle(id: number, on: boolean): void {
    this.picked.update(v => (on ? [...v, id] : v.filter(x => x !== id)));
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (!this.picked().length || this.saving()) return;
    this.saving.set(true);
    try {
      const created = await this.store.copy(this.data.ids, this.picked());
      this.log.record('Enrollment', `Copied ${this.courses.length} course(s) to ${this.picked().length} batch(es): ${created} new`);
      this.toast.success(created ? 'Courses copied' : 'Nothing new to copy', created ? `${created} course run(s) added.` : 'Those batches already take these courses.');
      this.ref.close(true);
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  close(): void { this.ref.close(false); }
}
