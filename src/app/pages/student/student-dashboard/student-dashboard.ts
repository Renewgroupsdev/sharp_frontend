import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { MyAttendanceService } from '../../../shared/common-services/my-attendance.service';
import { MyCourseSummary, MyLearningService } from '../../../shared/common-services/my-learning.service';
import { RoleDashboard } from '../../../shared/components/role-dashboard/role-dashboard';
import { SubmissionStatsCard } from '../../../shared/components/submission-stats/submission-stats';

const RING_R = 34;
const RING_LEN = 2 * Math.PI * RING_R;

/** Student home, from the student's own data: courses and lesson progress, attendance and profile. */
@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [RouterLink, SubmissionStatsCard, RoleDashboard],
  templateUrl: './student-dashboard.html',
  styleUrls: ['../student.scss', './student-dashboard.scss'],
})
export class StudentDashboard implements OnInit {
  private readonly router = inject(Router);
  private readonly learning = inject(MyLearningService);
  private readonly attendance = inject(MyAttendanceService);
  private readonly auth = inject(AuthService);

  readonly ringR = RING_R;
  readonly ringLen = RING_LEN;
  readonly error = signal<string | null>(null);

  readonly courses = this.learning.courses;
  readonly loaded = this.learning.loaded;
  readonly attendancePct = this.attendance.rate;
  readonly recentAttendance = computed(() => this.attendance.records().slice(0, 4));

  readonly name = computed(() => this.auth.actor().n);
  readonly batch = computed(() => this.attendance.student()?.batch ?? '');
  readonly org = computed(() => this.attendance.student()?.org ?? '');

  /** Soft card backdrops and icons, cycled over the course cards. */
  readonly tints = [
    { bg: 'linear-gradient(135deg,#fde8f1,#fff4f8)', fg: '#c2186b', icon: 'bi-chat-quote' },
    { bg: 'linear-gradient(135deg,#e4f1fb,#f2f9fe)', fg: '#0b6c9a', icon: 'bi-people' },
    { bg: 'linear-gradient(135deg,#fff1dc,#fff9ef)', fg: '#c47c14', icon: 'bi-lightbulb' },
    { bg: 'linear-gradient(135deg,#e6f6ec,#f3fbf6)', fg: '#0e7a4e', icon: 'bi-graph-up-arrow' },
    { bg: 'linear-gradient(135deg,#ece8fb,#f6f4fd)', fg: '#6a4cb3', icon: 'bi-clipboard-check' },
    { bg: 'linear-gradient(135deg,#e1f4f2,#f1fbfa)', fg: '#0a8a80', icon: 'bi-briefcase' },
  ];

  readonly shortcuts = [
    { link: '/app/learning', icon: 'bi-journal-richtext', label: 'My Learning', c: '#c2186b', bg: '#fde8f1' },
    { link: '/app/attendance', icon: 'bi-clock-history', label: 'Attendance', c: '#0b6c9a', bg: '#e4f1fb' },
    { link: '/app/assessments', icon: 'bi-patch-check', label: 'Assessments', c: '#c47c14', bg: '#fff1dc' },
    { link: '/app/certificates', icon: 'bi-award', label: 'Certificates', c: '#0e7a4e', bg: '#e6f6ec' },
    { link: '/app/community', icon: 'bi-chat-dots', label: 'SHARP Community', c: '#6a4cb3', bg: '#ece8fb' },
  ];

  readonly done = computed(() => this.courses().filter(c => c.status === 'Completed').length);
  readonly inProgress = computed(() => this.courses().filter(c => c.status === 'In progress').length);
  readonly notStarted = computed(() => this.courses().filter(c => c.status === 'Not started').length);
  readonly overall = computed(() => {
    const list = this.courses();
    return list.length ? Math.round(list.reduce((a, c) => a + c.progress, 0) / list.length) : 0;
  });
  readonly ringOffset = computed(() => RING_LEN * (1 - this.overall() / 100));

  /** The course to resume: the most recently opened unfinished one, else the first unfinished, else the first. */
  readonly current = computed<MyCourseSummary | undefined>(() => {
    const open = this.courses().filter(c => c.status !== 'Completed');
    return [...open].sort((a, b) => (b.last_accessed ?? '').localeCompare(a.last_accessed ?? ''))[0] ?? this.courses()[0];
  });

  readonly greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  ngOnInit(): void {
    this.learning.load().catch(e => this.error.set(apiErrorMessage(e)));
    this.attendance.load().catch(() => undefined);
  }

  tint(i: number) {
    return this.tints[i % this.tints.length];
  }

  attendancePill(status: string): string {
    return status === 'Present' ? 'g' : status === 'Absent' ? 'd' : 'w';
  }

  open(courseId?: number): void {
    void this.router.navigateByUrl(courseId ? `/app/learning/${courseId}` : '/app/learning');
  }
}
