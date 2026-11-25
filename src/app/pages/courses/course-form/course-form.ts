import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';
import { AssessmentsService } from '../../../shared/common-services/assessments.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { BatchesService } from '../../../shared/common-services/batches.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { UsersService } from '../../../shared/common-services/users.service';
import { COURSE_LEVELS, COURSE_MODES, COURSE_SCOPES, COURSE_STATUSES, Course, lessonsOf, mentorsOf } from '../../../shared/models/course.model';
import { CourseModules } from '../course-modules/course-modules';

interface CourseDraft {
  title: string; category: string; hours: number; mentors: string[]; batches: string[]; mode: string; level: string; scope: string; status: string;
  desc: string; outcomes: string; reqs: string; thumb: string;
}

/** Add / edit course wizard: curriculum, then its modules and lessons. Assignments, assessments and quizzes live under Course Management. */
@Component({
  selector: 'app-course-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule, CourseModules],
  templateUrl: './course-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './course-form.scss'],
})
export class CourseForm {
  private readonly dialogRef = inject(MatDialogRef<CourseForm, boolean>);
  private readonly data = inject<{ courseId?: string }>(MAT_DIALOG_DATA);
  private readonly store = inject(CoursesService);
  private readonly batchStore = inject(BatchesService);
  private readonly users = inject(UsersService);
  private readonly assessments = inject(AssessmentsService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);

  readonly steps: { label: string; icon: string }[] = [
    { label: 'Course details', icon: 'bi-journal-text' },
    { label: 'Modules & lessons', icon: 'bi-list-nested' },
  ];
  readonly lastStep = this.steps.length - 1;
  readonly modes = COURSE_MODES;
  readonly levels = COURSE_LEVELS;
  readonly scopes = COURSE_SCOPES;
  readonly statuses = COURSE_STATUSES;

  /** Id of the course being edited, or of the one just created in step 1. */
  readonly courseId = signal<string>(this.data.courseId ?? '');
  readonly step = signal(0);
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly course = computed<Course | undefined>(() => this.store.items().find(c => c.id === this.courseId()));
  readonly isEdit = !!this.data.courseId;
  /** Users with the Mentor role. A name already on the course stays listed so editing an older course never drops it. */
  readonly mentorNames = computed(() => {
    const names = this.users.items().filter(u => u.r === 'Mentor').map(u => u.n);
    return [...names, ...this.model.mentors.filter(n => !names.includes(n))];
  });
  readonly batchOptions = computed(() => this.batchStore.items().map(b => ({ name: b.n, students: this.batchStore.studentCount(b) })));

  constructor() { this.batchStore.loadBatches().catch(() => undefined); }

  readonly categoryOptions = computed(() => {
    const current = this.model.category;
    return this.store.categories.items().filter(k => k.st === 'Active' || k.n === current).map(k => k.n);
  });

  model: CourseDraft = this.initial();

  private initial(): CourseDraft {
    const c = this.store.get(this.data.courseId ?? '');
    const firstActive = this.store.categories.items().find(k => k.st === 'Active')?.n ?? '';
    return {
      title: c?.title ?? '',
      category: c?.category ?? firstActive,
      hours: c?.hours ?? 6,
      mentors: c ? mentorsOf(c) : [],
      batches: c ? [...c.batches] : [],
      mode: c?.mode ?? 'On Campus',
      level: c?.level ?? 'Beginner',
      scope: c?.scope ?? 'Public',
      status: c?.status ?? 'Draft',
      desc: c?.desc ?? '',
      outcomes: c?.outcomes ?? '',
      reqs: c?.reqs ?? '',
      thumb: c?.thumb ?? '',
    };
  }

  close(): void { this.dialogRef.close(!!this.courseId()); }

  goTo(i: number): void {
    if (i > 0 && !this.courseId()) return;
    this.step.set(i);
  }

  /** Students who will be enrolled: everyone in the ticked batches. */
  enrolledCount(): number {
    return this.batchOptions().filter(b => this.model.batches.includes(b.name)).reduce((n, b) => n + b.students, 0);
  }

  toggleBatch(name: string, checked: boolean): void {
    this.model.batches = checked ? [...this.model.batches, name] : this.model.batches.filter(b => b !== name);
  }

  toggleMentor(name: string, checked: boolean): void {
    this.model.mentors = checked ? [...this.model.mentors, name] : this.model.mentors.filter(m => m !== name);
  }

  onThumb(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 300 * 1024) {
      (event.target as HTMLInputElement).value = '';
      return this.toast.error('Thumbnail must be under 300 KB');
    }
    const reader = new FileReader();
    reader.onload = () => (this.model.thumb = String(reader.result));
    reader.readAsDataURL(file);
  }

  /** Step 1: create or update the course, then move on to its modules. */
  async saveCurriculum(form: NgForm): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    const m = this.model, title = m.title.trim();
    if (form.invalid || !title || !m.category) return;
    const existing = this.course();
    if (this.store.live().some(x => x.id !== existing?.id && x.title.toLowerCase() === title.toLowerCase())) {
      this.serverError.set('A course with this title already exists');
      return;
    }
    const fields = {
      title, category: m.category, hours: Number(m.hours) || 1, trainer: m.mentors.join(', ') || 'Unassigned', mode: m.mode,
      batchIds: m.batches.map(n => Number(this.batchStore.items().find(b => b.n === n)?.id)).filter(id => Number.isFinite(id) && id > 0), level: m.level,
      scope: m.scope, status: m.status, desc: m.desc.trim(), outcomes: m.outcomes.trim(), reqs: m.reqs.trim(), thumb: m.thumb,
    };
    this.saving.set(true);
    try {
      const saved = await this.store.saveCourse(fields, existing?.id);
      if (existing) {
        if (existing.title !== title) this.assessments.renameCourse(existing.title, title);
        this.log.record('Course Management', `Updated course ${saved.code ?? saved.id} — ${title}`);
        this.toast.success('Curriculum saved');
      } else {
        this.courseId.set(saved.id);
        this.log.record('Course Management', `Created course ${saved.code ?? saved.id} — ${title}`);
        this.toast.success('Course created', 'Now add modules / topics.');
      }
      this.batchStore.loadBatches().catch(() => undefined); // batch list shows its courses
      this.step.set(1);
    } catch (error) {
      this.serverError.set(apiErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  finish(): void {
    const c = this.course();
    if (c) {
      const hidden = c.status === 'Published' ? '' : ` It is ${c.status.toLowerCase()}, so learners cannot see it until it is published.`;
      this.toast.success(`“${c.title}” is set up`, `${c.chapters.length} modules, ${lessonsOf(c).length} lessons.${hidden}`);
    }
    this.dialogRef.close(true);
  }
}
