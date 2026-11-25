import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { Chapter } from '../../../shared/models/course.model';

/** Add / edit one module (chapter) of a course. */
@Component({
  selector: 'app-chapter-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './chapter-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class ChapterForm {
  private readonly dialogRef = inject(MatDialogRef<ChapterForm, boolean>);
  private readonly data = inject<{ courseId: string; chapterId?: string }>(MAT_DIALOG_DATA);
  private readonly store = inject(CoursesService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);

  readonly course = this.store.get(this.data.courseId);
  readonly existing = this.course?.chapters.find(c => c.id === this.data.chapterId);
  readonly isEdit = !!this.existing;
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);

  model = {
    name: this.existing?.name ?? '',
    desc: this.existing?.desc ?? '',
    status: this.existing?.status ?? 'Published',
  };

  close(): void { this.dialogRef.close(false); }

  save(form: NgForm): void {
    this.submitted.set(true);
    this.serverError.set(null);
    const course = this.course;
    const name = this.model.name.trim();
    if (!course || form.invalid || !name) return;
    if (course.chapters.some(c => c.id !== this.existing?.id && c.name.toLowerCase() === name.toLowerCase())) {
      this.serverError.set('A module with this name already exists in the course');
      return;
    }
    const details = { name, desc: this.model.desc.trim(), status: this.model.status as Chapter['status'] };
    const chapters: Chapter[] = this.existing
      ? course.chapters.map(c => (c.id === this.existing!.id ? { ...c, ...details } : c))
      : [...course.chapters, { id: `CH${Date.now().toString(36)}`, ...details, lessons: [] }];
    this.store.setChapters(course.id, chapters);
    this.log.record('Course Management', `${this.existing ? 'Updated' : 'Added'} module “${name}” in ${course.title}`);
    this.toast.success(this.existing ? 'Module updated' : 'Module added');
    this.dialogRef.close(true);
  }
}
