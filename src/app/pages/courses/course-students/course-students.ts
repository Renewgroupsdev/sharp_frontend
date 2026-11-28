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
import { CommunityApi } from '../../../shared/common-services/community-api.service';
import { LearningApi, ModuleReportRow } from '../../../shared/common-services/learning-api.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { lessonsOf, today } from '../../../shared/models/course.model';
import { CourseInvite } from './course-invite';

type StudentView = 'list' | 'status' | 'notify';

interface StudentRow { sid: string; name: string; phone: string; email: string; progress: number }

/** Students enrolled in a course, with each student's topic status and a personal message to send. */
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
  private readonly learningApi = inject(LearningApi);
  private readonly communityApi = inject(CommunityApi);
  readonly sending = signal(false);

  /** The picked student's real lesson completions, by module (from the server). */
  readonly report = signal<ModuleReportRow[] | null>(null);
  readonly reportBusy = signal(false);
  private readonly doneLessons = computed(() => new Set((this.report() ?? []).flatMap(m => (m.lessons ?? []).filter(l => l.done).map(l => String(l.id)))));

  readonly canEdit = this.auth.hasActionAccess('a_courses.edit');
  readonly course = computed(() => this.store.get(this.data.courseId));
  readonly view = signal<StudentView>('list');
  readonly submitted = signal(false);
  readonly sid = signal('');

  /** Each student's real completion of this course, from the server (the enrolment list only holds a placeholder). */
  private readonly liveProgress = signal<ReadonlyMap<string, number>>(new Map());

  constructor() {
    const c = this.store.get(this.data.courseId);
    if (c) {
      this.learningApi.list({ course_id: Number(c.id) })
        .then(list => this.liveProgress.set(new Map(list.map(r => [r.student_id, r.progress]))))
        .catch(() => undefined);
    }
  }

  readonly rows = computed<StudentRow[]>(() => {
    const c = this.course();
    if (!c) return [];
    return this.enrollments.forCourse(c.title).map(e => {
      const u = this.users.get(e.sid);
      return { sid: e.sid, name: e.name, phone: u?.ph || '—', email: u?.email || '—', progress: this.liveProgress().get(e.sid) ?? e.progress ?? 0 };
    });
  });

  readonly student = computed(() => this.rows().find(r => r.sid === this.sid()));

  /** Each topic with its real status for the student, and the quiz result. */
  readonly topics = computed(() => {
    const c = this.course(), s = this.student();
    if (!c || !s) return [];
    const lessons = lessonsOf(c), real = this.report() !== null, doneIds = this.doneLessons();
    const nextOpen = lessons.findIndex(l => !doneIds.has(String(l.id)));
    const quizzes = this.assessments.quizzes().filter(q => q.course === c.title);
    const results = this.assessments.results.items().filter(r => r.sid === s.sid);
    return lessons.map((l, i) => {
      // A topic's quiz is the course quiz set up for that topic; "—" when it has none.
      const quiz = quizzes.find(q => q.topic === l.name);
      const res = quiz && results.find(r => r.quizId === quiz.id);
      return {
        name: l.name,
        chapter: l.ch,
        status: !real ? '…' : doneIds.has(String(l.id)) ? 'Completed' : i === nextOpen && doneIds.size > 0 ? 'In progress' : 'Not started',
        quizStatus: !quiz ? '—' : !res ? 'Not attempted' : res.result >= res.minp ? 'Passed' : 'Failed',
        result: res ? `${res.result}%` : '—',
      };
    });
  });

  /** Number of quizzes on the course, shown above the status table. */
  readonly quizCount = computed(() => this.assessments.quizzes().filter(q => q.course === this.course()?.title).length);

  model = { msg: '' };

  close(): void { this.dialogRef.close(); }

  go(view: StudentView, sid = this.sid()): void {
    const s = this.rows().find(r => r.sid === sid);
    this.sid.set(sid);
    this.submitted.set(false);
    this.model = {
      msg: s ? `Hi ${s.name.split(' ')[0]}, you are at ${s.progress}% in ${this.course()?.title}. Please continue with your next lesson.` : '',
    };
    this.view.set(view);
    if (view === 'status') void this.loadReport(sid);
  }

  private async loadReport(sid: string): Promise<void> {
    const c = this.course();
    this.report.set(null);
    if (!c) return;
    this.reportBusy.set(true);
    try {
      this.report.set(await this.learningApi.moduleReport(sid, Number(c.id)));
    } catch {
      this.report.set([]);
    } finally {
      this.reportBusy.set(false);
    }
  }

  invite(): void {
    this.dialog.open(CourseInvite, { data: { courseId: this.data.courseId }, width: '560px', maxWidth: '96vw', autoFocus: false });
  }

  /** Posts the message in the course's chat group (SHARP Community), addressed to the student. */
  async sendNotification(): Promise<void> {
    this.submitted.set(true);
    const s = this.student();
    const text = this.model.msg.trim();
    if (!s || !text || this.sending()) return;
    this.sending.set(true);
    try {
      const courseId = Number(this.data.courseId);
      const chat = (await this.communityApi.groups({ source: 'course', kind: 'Chat' })).find(g => g.course_id === courseId);
      if (!chat) throw new Error('This course has no chat group yet. It is created once a batch takes the course.');
      await this.communityApi.postMessage(chat.id, `@${s.name}: ${text}`);
      this.log.record('Course Management', `Message to ${s.name} (${s.sid}) posted in the ${this.course()?.title} chat group`);
      this.toast.success('Message sent', `Posted in the ${this.course()?.title} chat group.`);
      this.go('list');
    } catch (e) {
      this.toast.error('Could not send the message', apiErrorMessage(e));
    } finally {
      this.sending.set(false);
    }
  }

}
