import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';
import { BatchEnrollmentsService } from '../../../shared/common-services/batch-enrollments.service';
import { BatchesService } from '../../../shared/common-services/batches.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { ToastService } from '../../../shared/common-services/toast.service';

/** New enrollment: pick one or more courses and the batches they run for. Every student in those batches is enrolled. */
@Component({
  selector: 'app-enrollment-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './enrollment-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class EnrollmentForm {
  private readonly ref = inject(MatDialogRef<EnrollmentForm, boolean>);
  private readonly store = inject(BatchEnrollmentsService);
  private readonly courseStore = inject(CoursesService);
  private readonly batchStore = inject(BatchesService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);

  readonly courses = this.courseStore.live().filter(c => /^\d+$/.test(c.id)).map(c => ({ id: Number(c.id), title: c.title }));
  readonly pickedCourses = signal<number[]>([]);
  readonly pickedBatches = signal<number[]>([]);
  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly batches = computed(() => this.batchStore.items()
    .filter(b => /^\d+$/.test(b.id))
    .map(b => ({ id: Number(b.id), name: b.n, students: this.batchStore.studentCount(b) })));

  /** New course-and-batch pairs this would create (existing ones are skipped). */
  readonly newPairs = computed(() => {
    const taken = new Set(this.store.items().map(e => `${e.courseId}:${e.batchId}`));
    return this.pickedCourses().flatMap(c => this.pickedBatches().map(b => `${c}:${b}`)).filter(p => !taken.has(p)).length;
  });

  /** Students who gain a course: the students of every batch, counted once per new course. */
  readonly studentTotal = computed(() => {
    const taken = new Set(this.store.items().map(e => `${e.courseId}:${e.batchId}`));
    return this.pickedCourses().reduce((n, c) => n + this.batches().filter(b => this.pickedBatches().includes(b.id) && !taken.has(`${c}:${b.id}`)).reduce((s, b) => s + b.students, 0), 0);
  });

  constructor() {
    this.batchStore.loadBatches().catch(() => undefined);
    this.store.loadFromApi().catch(() => undefined);
  }

  toggle(list: WritableSignal<number[]>, id: number, on: boolean): void {
    list.update(v => (on ? [...v, id] : v.filter(x => x !== id)));
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (!this.pickedCourses().length || !this.pickedBatches().length || this.saving()) return;
    this.saving.set(true);
    try {
      const added = await this.store.enroll(this.pickedCourses(), this.pickedBatches());
      this.log.record('Enrollment', `Created ${added} enrollment(s)`);
      this.toast.success(added ? 'Enrollment created' : 'Nothing new to enrol', added ? `${added} course run(s) added.` : 'Those batches already take the chosen courses.');
      this.ref.close(true);
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  close(): void { this.ref.close(false); }
}
