import { Component, computed, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { HOST_ICON, hostLabel } from '../../../shared/models/course.model';
import { ChapterForm } from '../chapter-form/chapter-form';
import { LessonForm } from '../lesson-form/lesson-form';

/** Modules (chapters) and lessons editor for one course; embedded in the course wizard and in the Modules / topics dialog. */
@Component({
  selector: 'app-course-modules',
  standalone: true,
  templateUrl: './course-modules.html',
  styleUrls: ['./course-modules.scss'],
})
export class CourseModules {
  private readonly store = inject(CoursesService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);

  readonly courseId = input.required<string>();
  readonly readonly = input(false);
  readonly course = computed(() => this.store.items().find(c => c.id === this.courseId()));
  readonly icon = HOST_ICON;
  readonly hostLabel = hostLabel;
  readonly totals = computed(() => {
    const chapters = this.course()?.chapters ?? [];
    const lessons = chapters.flatMap(ch => ch.lessons);
    return { lessons: lessons.length, minutes: lessons.reduce((n, l) => n + (l.dur || 0), 0) };
  });

  /** Add (no id) or edit a module in the module form. */
  openModule(chapterId?: string): void {
    this.dialog.open(ChapterForm, {
      width: '560px', maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', autoFocus: false,
      data: { courseId: this.courseId(), chapterId },
    });
  }

  async deleteChapter(id: string): Promise<void> {
    const c = this.course(), ch = c?.chapters.find(x => x.id === id);
    if (!c || !ch) return;
    if (ch.lessons.length && !(await this.toast.confirm('Delete this module?', `${ch.name} and its ${ch.lessons.length} lesson(s) will be removed.`))) return;
    this.store.setChapters(c.id, c.chapters.filter(x => x.id !== id));
    this.log.record('Course Management', `Deleted module “${ch.name}” from ${c.title}`);
  }

  openLesson(chapterId: string, lessonId?: string): void {
    this.dialog.open(LessonForm, {
      width: '640px', maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', autoFocus: false,
      data: { courseId: this.courseId(), chapterId, lessonId },
    });
  }

  async deleteLesson(chapterId: string, lessonId: string): Promise<void> {
    const c = this.course();
    if (!c) return;
    if (!(await this.toast.confirm('Delete lesson?', 'This lesson will be removed from the module.'))) return;
    this.store.setChapters(c.id, c.chapters.map(ch => (ch.id === chapterId ? { ...ch, lessons: ch.lessons.filter(l => l.id !== lessonId) } : ch)));
    this.log.record('Course Management', `Deleted a lesson from ${c.title}`);
  }
}
