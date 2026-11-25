import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AssessmentsService } from '../../../shared/common-services/assessments.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ToastService } from '../../../shared/common-services/toast.service';
import { ASSESS_STATUSES, ASSESS_TYPES, AssessType, Assessment, usesQuestions } from '../../../shared/models/assessment.model';
import { DOCUMENT_ACCEPT, documentProblem } from '../../../shared/utils/upload.util';

/** Create / edit a quiz, assignment or assessment. */
@Component({
  selector: 'app-assessment-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './assessment-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', '../assess-dialog.scss'],
})
export class AssessmentForm {
  private readonly dialogRef = inject(MatDialogRef<AssessmentForm, Assessment>);
  private readonly data = inject<{ id?: string; type?: AssessType; course?: string; lockType?: boolean }>(MAT_DIALOG_DATA);
  private readonly toast = inject(ToastService);
  readonly store = inject(AssessmentsService);

  readonly types = ASSESS_TYPES;
  readonly statuses = ASSESS_STATUSES;
  readonly existing = this.data.id ? this.store.get(this.data.id) : undefined;
  /** Opened from a course: its course and the chosen type are fixed. */
  readonly locked = !!this.data.course && !this.data.id;
  /** The type is fixed when opened from a course or from a Quiz / Assessment / Assignment tab. */
  readonly typeLocked = this.locked || !!this.data.lockType;
  readonly courses = [...new Set([...this.store.courseTitles(), ...(this.data.course ? [this.data.course] : []), ...(this.existing ? [this.existing.course] : [])])];
  readonly isEdit = !!this.existing;
  readonly submitted = signal(false);
  readonly saving = signal(false);

  model = {
    type: (this.existing?.type ?? this.data.type ?? 'Quiz') as AssessType,
    title: this.existing?.title ?? '',
    course: this.existing?.course ?? this.data.course ?? this.courses[0] ?? '',
    module: this.existing?.module ?? '',
    topic: this.existing?.topic ?? 'All topics',
    status: this.existing?.status ?? 'Draft',
    dueIso: this.existing?.dueIso ?? '',
    max: this.existing?.max ?? 50,
    minp: this.existing?.minp ?? 60,
    desc: this.existing?.desc ?? '',
    groups: [...(this.existing?.setup?.groups ?? [])],
  };
  readonly accept = DOCUMENT_ACCEPT;
  /** A document chosen in this dialog, uploaded after the record is saved. */
  file: File | null = null;
  /** Remove the document the record already has. */
  removeFile = false;

  constructor() {
    if (!this.model.module) this.model.module = this.store.moduleOptions(this.model.course)[0] ?? 'General';
  }

  get typeIcon(): string {
    return { Quiz: 'bi-patch-question', Assignment: 'bi-file-earmark-text', Assessment: 'bi-patch-check' }[this.model.type];
  }

  get subtitle(): string {
    return { Quiz: 'Quizzes can be created for each lesson or topic', Assignment: 'Work learners submit by a date, with marks', Assessment: 'Assessments can be created for each lesson or topic' }[this.model.type];
  }

  /** Quizzes and assessments are answered question by question; only assignments are handed in. */
  get isQuiz(): boolean { return usesQuestions(this.model.type); }
  get modules(): string[] { return this.store.moduleOptions(this.model.course); }
  get topics(): string[] { return this.store.topicOptions(this.model.course); }

  onCourse(): void {
    this.model.module = this.modules[0] ?? 'General';
    this.model.topic = 'All topics';
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    const problem = f ? documentProblem(f) : null;
    if (problem) {
      this.toast.error(problem);
      input.value = '';
    }
    this.file = problem ? null : f;
  }

  hasGroup(id: string): boolean { return this.model.groups.includes(id); }

  toggleGroup(id: string, on: boolean): void {
    this.model.groups = on ? [...this.model.groups, id] : this.model.groups.filter(g => g !== id);
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    const m = this.model;
    if (!m.title.trim()) return void this.toast.error('Title is required');
    if (!this.isQuiz) {
      if (!m.dueIso) return void this.toast.error('Submit date is required for assignments');
      if (!(Number(m.max) > 0)) return void this.toast.error('Marks must be greater than 0');
      if (!(Number(m.minp) >= 0 && Number(m.minp) <= 100)) return void this.toast.error('Minimum percentage must be between 0 and 100');
    }
    if (this.saving()) return;
    this.saving.set(true);
    try {
      let rec = await this.store.save({
        type: m.type, title: m.title.trim(), course: m.course, module: m.module, topic: m.topic, status: m.status,
        dueIso: m.dueIso, max: Number(m.max), minp: Number(m.minp), desc: m.desc.trim(), groups: m.groups,
      }, this.existing?.id);
      const fileError = await this.syncFile(rec);
      rec = this.store.get(rec.id) ?? rec;
      if (fileError) this.toast.error(`${m.type} saved, but the document was not updated: ${fileError}`);
      else this.toast.success(`${m.type} ${this.isEdit ? 'updated' : 'created'}`);
      this.dialogRef.close(rec);
    } catch (e) {
      this.toast.error(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  /** Uploads the chosen document or removes the old one; resolves with an error message, or null when nothing failed. */
  private async syncFile(rec: Assessment): Promise<string | null> {
    if (this.isQuiz || (!this.file && !(this.removeFile && rec.attach))) return null;
    try {
      await this.store.setAttachment(rec.id, this.file);
      return null;
    } catch (e) {
      return apiErrorMessage(e);
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
