import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { LearningService } from '../../../shared/common-services/learning.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { UsersService } from '../../../shared/common-services/users.service';

/** Add / edit a learning record: pick a course, then one of the students enrolled in it through their batch. */
@Component({
  selector: 'app-learning-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './learning-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class LearningForm {
  private readonly dialogRef = inject(MatDialogRef<LearningForm, boolean>);
  private readonly data = inject<{ id?: string }>(MAT_DIALOG_DATA);
  private readonly store = inject(LearningService);
  private readonly courseStore = inject(CoursesService);
  private readonly users = inject(UsersService);
  private readonly log = inject(ActivityLogService);
  private readonly toast = inject(ToastService);

  private readonly existing = this.data.id ? this.store.get(this.data.id) : undefined;
  readonly isEdit = !!this.existing;
  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);

  /** Only courses that are mapped to at least one batch have enrolled students. */
  readonly courses = this.courseStore.live().filter(c => c.batchIds.length || c.id === String(this.existing?.courseId));

  model = {
    courseId: this.existing ? String(this.existing.courseId) : '',
    sid: this.existing?.sid ?? '',
    progress: this.existing?.progress ?? 0,
    mats: this.existing?.mats ?? 0,
    last: this.existing?.last ?? '',
  };

  /** Students of the batches the chosen course is mapped to. */
  readonly courseId = signal(this.model.courseId);
  readonly students = computed(() => {
    const batches = this.courseStore.get(this.courseId())?.batches ?? [];
    return this.users.students().filter(u => batches.includes(u.b));
  });

  onCourseChange(id: string): void {
    this.courseId.set(id);
    if (!this.students().some(s => s.id === this.model.sid)) this.model.sid = '';
  }

  async save(form: NgForm): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (form.invalid || this.saving()) return;
    const m = this.model, course = this.courseStore.get(m.courseId);
    if (!course) return;
    this.saving.set(true);
    try {
      const rec = await this.store.save({ sid: m.sid, courseId: Number(m.courseId), progress: m.progress, mats: m.mats, last: m.last });
      this.log.record('Learning Management', `${this.isEdit ? 'Updated' : 'Added'} learning progress — ${rec.name} in ${rec.course}`);
      this.toast.success(this.isEdit ? 'Learning record updated' : 'Learning record saved');
      this.dialogRef.close(true);
    } catch (error) {
      this.serverError.set(apiErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
