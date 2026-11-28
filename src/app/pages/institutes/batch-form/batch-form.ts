import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { BatchesService, batchDateToIso, isoToBatchDate } from '../../../shared/common-services/batches.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { InstitutesService } from '../../../shared/common-services/institutes.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { BatchInput, BatchRecord } from '../../../shared/models/institute.model';

export const BATCH_STATUSES: { value: string; label: string }[] = [
  { value: 'enrolling', label: 'Upcoming (enrolling)' },
  { value: 'running', label: 'In progress' },
  { value: 'closed', label: 'Closed' },
];

/** Create / edit a batch: schedule, seats, mentors and the institutes taking part. */
@Component({
  selector: 'app-batch-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './batch-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './batch-form.scss'],
})
export class BatchForm {
  private readonly dialogRef = inject(MatDialogRef<BatchForm, BatchRecord | undefined>);
  private readonly data = inject<{ batchId?: string }>(MAT_DIALOG_DATA);
  private readonly store = inject(BatchesService);
  private readonly institutes = inject(InstitutesService);
  private readonly courses = inject(CoursesService);
  private readonly toast = inject(ToastService);

  readonly existing = this.data.batchId ? this.store.get(this.data.batchId) : undefined;
  readonly isEdit = !!this.existing;
  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly statuses = BATCH_STATUSES;
  readonly instituteNames = computed(() => this.institutes.names());
  readonly courseTitles = computed(() => this.courses.courseTitles());

  constructor() { this.courses.loadFromApi().catch(() => undefined); }

  /** Seats cannot drop below the students already placed in the batch. */
  readonly minSeats = this.existing ? Math.max(1, this.store.studentCount(this.existing)) : 1;

  /** Dates are edited as ISO strings (date inputs) and stored as "14 Jun 2026". */
  startIso = this.existing ? batchDateToIso(this.existing.start) : '';
  endIso = this.existing ? batchDateToIso(this.existing.end) : '';

  model: BatchInput = this.existing
    ? { n: this.existing.n, start: this.existing.start, end: this.existing.end, seats: this.existing.seats, mentors: this.existing.mentors, st: this.existing.st, orgs: [...(this.existing.orgs ?? [])], courses: [...(this.existing.courses ?? [])] }
    : { n: '', start: '', end: '', seats: 60, mentors: 0, st: 'enrolling', orgs: [], courses: [] };

  /** True when the end date is not after the start date. */
  get badRange(): boolean {
    return !!this.startIso && !!this.endIso && this.endIso <= this.startIso;
  }

  isPicked(name: string): boolean {
    return this.model.orgs.includes(name);
  }

  /** Adds / removes an institute from the participating list. */
  toggleInstitute(name: string, on: boolean): void {
    this.model.orgs = on ? [...this.model.orgs, name] : this.model.orgs.filter(x => x !== name);
  }

  get allInstitutes(): boolean { const n = this.instituteNames(); return n.length > 0 && n.every(x => this.model.orgs.includes(x)); }
  get allCourses(): boolean { const t = this.courseTitles(); return t.length > 0 && t.every(x => this.model.courses.includes(x)); }

  /** Ticks or clears every institute. */
  toggleAllInstitutes(on: boolean): void { this.model.orgs = on ? [...this.instituteNames()] : []; }

  /** Ticks or clears every course. */
  toggleAllCourses(on: boolean): void { this.model.courses = on ? [...this.courseTitles()] : []; }

  toggleCourse(title: string, on: boolean): void {
    this.model.courses = on ? [...this.model.courses, title] : this.model.courses.filter(x => x !== title);
  }

  /** Validates, saves and closes with the saved record; a duplicate name is reported inline. */
  async save(form: NgForm): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (form.invalid || this.badRange || this.saving()) return;
    if (this.store.nameTaken(this.model.n, this.existing?.id)) {
      return void this.serverError.set(`A batch named "${this.model.n.trim()}" already exists.`);
    }
    this.model.start = isoToBatchDate(this.startIso);
    this.model.end = isoToBatchDate(this.endIso);
    this.saving.set(true);
    try {
      const rec = await this.store.saveBatch(this.model, this.existing?.id);
      this.toast.success(this.isEdit ? 'Batch updated' : 'Batch created');
      this.dialogRef.close(rec);
    } catch (error) {
      this.serverError.set(apiErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
