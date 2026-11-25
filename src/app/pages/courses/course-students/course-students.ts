import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../../core/auth/auth.service';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';
import { AssessmentsService } from '../../../shared/common-services/assessments.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { EnrollmentService } from '../../../shared/common-services/enrollment.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { UsersService } from '../../../shared/common-services/users.service';
import { lessonsOf, today } from '../../../shared/models/course.model';
import { CourseInvite } from './course-invite';

type StudentView = 'list' | 'status' | 'notify' | 'feedback';

interface StudentRow { sid: string; name: string; phone: string; email: string; progress: number }

/** Students enrolled in a course, with each student's topic status, a notification and mentor feedback. */
@Component({
  selector: 'app-course-students',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './course-students.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './course-students.scss'],
})
export class CourseStudents {
  private readonly dialogRef = inject(MatDialogRef<CourseStudents>);
  private readonly data = inject<{ courseId: string }>(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);
  private readonly store = inject(CoursesService);
  private readonly enrollments = inject(EnrollmentService);
  private readonly users = inject(UsersService);
  private readonly assessments = inject(AssessmentsService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);
  private readonly auth = inject(AuthService);

  readonly canEdit = this.auth.hasActionAccess('a_courses.edit');
  readonly course = computed(() => this.store.get(this.data.courseId));
  readonly view = signal<StudentView>('list');
  readonly submitted = signal(false);
  readonly sid = signal('');

  readonly rows = computed<StudentRow[]>(() => {
    const c = this.course();
    if (!c) return [];
    return this.enrollments.forCourse(c.title).map(e => {
      const u = this.users.get(e.sid);
      return { sid: e.sid, name: e.name, phone: u?.ph || '—', email: u?.email || '—', progress: e.progress ?? 0 };
    });
  });

  readonly student = computed(() => this.rows().find(r => r.sid === this.sid()));

  /** Topics with a status derived from the student's overall progress, plus the feedback left on each. */
  readonly topics = computed(() => {
    const c = this.course(), s = this.student();
    if (!c || !s) return [];
    const lessons = lessonsOf(c), done = Math.round(s.progress / 100 * lessons.length);
    const feedback = this.store.feedback.items().filter(f => f.cid === c.id && f.sid === s.sid);
    const quizzes = this.assessments.quizzes().filter(q => q.course === c.title);
    const results = this.assessments.results.items().filter(r => r.sid === s.sid);
    return lessons.map((l, i) => {
      // A topic's quiz is the course quiz set up for that topic; "—" when it has none.
      const quiz = quizzes.find(q => q.topic === l.name);
      const res = quiz && results.find(r => r.quizId === quiz.id);
      return {
        name: l.name,
        chapter: l.ch,
        status: i < done ? 'Completed' : i === done && s.progress > 0 && s.progress < 100 ? 'In progress' : 'Not started',
        quizStatus: !quiz ? '—' : !res ? 'Not attempted' : res.result >= res.minp ? 'Passed' : 'Failed',
        result: res ? `${res.result}%` : '—',
        feedback: feedback.filter(f => f.topic === l.id).map(f => f.text),
      };
    });
  });

  /** Number of quizzes on the course, shown above the status table. */
  readonly quizCount = computed(() => this.assessments.quizzes().filter(q => q.course === this.course()?.title).length);

  readonly overallFeedback = computed(() => {
    const c = this.course();
    return c ? this.store.feedback.items().filter(f => f.cid === c.id && f.sid === this.sid() && !f.topic) : [];
  });

  readonly lessonOptions = computed(() => {
    const c = this.course();
    return c ? lessonsOf(c).map(l => ({ id: l.id, name: l.name })) : [];
  });

  model = { msg: '', topic: '', text: '' };

  close(): void { this.dialogRef.close(); }

  go(view: StudentView, sid = this.sid()): void {
    const s = this.rows().find(r => r.sid === sid);
    this.sid.set(sid);
    this.submitted.set(false);
    this.model = {
      msg: s ? `Hi ${s.name.split(' ')[0]}, you are at ${s.progress}% in ${this.course()?.title}. Please continue with your next lesson.` : '',
      topic: '',
      text: '',
    };
    this.view.set(view);
  }

  invite(): void {
    this.dialog.open(CourseInvite, { data: { courseId: this.data.courseId }, width: '560px', maxWidth: '96vw', autoFocus: false });
  }

  sendNotification(): void {
    this.submitted.set(true);
    const s = this.student();
    if (!s || !this.model.msg.trim()) return;
    this.log.record('Course Management', `Notification sent to ${s.name} (${s.sid}) for ${this.course()?.title}`);
    this.toast.success('Notification sent', s.name);
    this.go('list');
  }

  saveFeedback(): void {
    this.submitted.set(true);
    const c = this.course(), s = this.student(), text = this.model.text.trim();
    if (!c || !s || !text) return;
    this.store.feedback.add({ cid: c.id, sid: s.sid, topic: this.model.topic, text, by: this.auth.actor().n, on: today() });
    this.log.record('Course Management', `Feedback added for ${s.name} on ${c.title}`);
    this.toast.success('Feedback saved');
    this.go('status');
  }
}
