import { Component, computed, inject, signal } from '@angular/core';
import { ROLES } from '../../core/data/models';
import { AUDIT_HEAD, AuditEntry, AuditLogsApi, auditRow } from '../../shared/common-services/audit-logs-api.service';
import { AttendanceService } from '../../shared/common-services/attendance.service';
import { AssessmentsService } from '../../shared/common-services/assessments.service';
import { BatchesService } from '../../shared/common-services/batches.service';
import { CertificatesService } from '../../shared/common-services/certificates.service';
import { CoursesService } from '../../shared/common-services/courses.service';
import { EnrollmentService } from '../../shared/common-services/enrollment.service';
import { InstitutesService } from '../../shared/common-services/institutes.service';
import { LearningService } from '../../shared/common-services/learning.service';
import { UsersService } from '../../shared/common-services/users.service';
import { CountRibbon } from '../../shared/components/count-ribbon/count-ribbon';
import { toCsv } from '../../shared/utils/csv.util';
import { fileStamp, saveBlob } from '../../shared/utils/export.util';

interface Bar { label: string; value: number }
interface BarChart { title: string; data: Bar[]; max: number }
interface ReportDef { key: string; title: string; head: string[]; rows: unknown[][] }

const chart = (title: string, data: Bar[]): BarChart => ({ title, data, max: Math.max(1, ...data.map(d => d.value)) });

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CountRibbon],
  templateUrl: './reports.html',
  styleUrls: ['../../shared/styles/erp-page.scss', './reports.scss'],
})
export class Reports {
  private readonly users = inject(UsersService);
  private readonly institutes = inject(InstitutesService);
  private readonly batches = inject(BatchesService);
  private readonly attendance = inject(AttendanceService);
  private readonly auditApi = inject(AuditLogsApi);
  /** The server's activity log: the same entries Logs Management shows. */
  private readonly audit = signal<AuditEntry[]>([]);
  private readonly certs = inject(CertificatesService);
  private readonly courses = inject(CoursesService);
  private readonly enrollment = inject(EnrollmentService);
  private readonly learning = inject(LearningService);
  private readonly assessments = inject(AssessmentsService);

  constructor() {
    this.certs.load().catch(() => undefined);
    this.auditApi.list().then(rows => this.audit.set(rows)).catch(() => undefined);
  }

  private readonly attendanceRate = computed(() => {
    const a = this.attendance.items();
    return a.length ? Math.round((a.filter(x => x.status !== 'Absent').length / a.length) * 100) : null;
  });

  private readonly avgProgress = computed(() => {
    const l = this.learning.items();
    return l.length ? Math.round(l.reduce((a, x) => a + x.progress, 0) / l.length) : null;
  });

  readonly tiles = computed(() => [
    { label: 'Users', value: this.users.items().length, icon: 'bi-people' },
    { label: 'Institutes', value: this.institutes.items().length, icon: 'bi-bank' },
    { label: 'Attendance rate', value: this.attendanceRate() === null ? '—' : this.attendanceRate() + '%', icon: 'bi-clock-history' },
    { label: 'Avg learning progress', value: this.avgProgress() === null ? '—' : this.avgProgress() + '%', icon: 'bi-play-circle' },
    { label: 'Certificates issued', value: this.certs.items().filter(c => c.status === 'Issued').length, icon: 'bi-award' },
    { label: 'Batches', value: this.batches.items().length, icon: 'bi-collection' },
    { label: 'Activity entries', value: this.audit().length, icon: 'bi-list-check' },
  ]);

  readonly charts = computed<BarChart[]>(() => {
    const users = this.users.items();
    const att = this.attendance.items();
    return [
      chart('Users by role', ROLES.map(r => ({ label: r, value: users.filter(u => u.r === r).length }))),
      chart('Students per institute', this.institutes.items().map(o => ({ label: o.n, value: users.filter(u => u.r === 'Student' && u.org === o.n).length }))),
      chart('Enrollments per course', this.courses.items().filter(c => !c.deleted).map(c => ({ label: c.title, value: this.enrollment.items().filter(e => e.course === c.title && e.status !== 'Dropped').length }))),
      chart('Seats filled per batch', this.batches.items().map(b => ({ label: b.n, value: b.filled }))),
      chart('Attendance by status', [
        { label: 'Present', value: att.filter(a => a.status === 'Present').length },
        { label: 'Absent', value: att.filter(a => a.status === 'Absent').length },
        { label: 'Manual marks', value: att.filter(a => a.mode === 'Manual').length },
      ]),
    ];
  });

  readonly reports = computed<ReportDef[]>(() => {
    const users = this.users.items();
    return [
      { key: 'users', title: 'Users', head: ['ID', 'Name', 'Role', 'Institute', 'Batch', 'Status', 'Email', 'Mobile'], rows: users.map(u => [u.id, u.n, u.r, u.org, u.b, u.st, u.email ?? '', u.ph]) },
      {
        key: 'institutes', title: 'Institutes', head: ['Code', 'Name', 'City', 'Principal', 'Email', 'Phone', 'Status', 'Students'],
        rows: this.institutes.items().map(o => [o.code, o.n, o.city, o.pr, o.email, o.ph, o.st, users.filter(u => u.r === 'Student' && u.org === o.n).length]),
      },
      { key: 'batches', title: 'Batches', head: ['ID', 'Name', 'Start', 'End', 'Seats', 'Filled', 'Mentors', 'Status'], rows: this.batches.items().map(b => [b.id, b.n, b.start, b.end, b.seats, b.filled, b.mentors, b.st]) },
      {
        key: 'attendance', title: 'Attendance (last 90 days)', head: ['Date', 'Student ID', 'Student', 'Batch', 'Status', 'How', 'Remarks'],
        rows: this.attendance.items().map(a => [a.date, a.sid, a.name, a.batch, a.status, a.method, a.remarks]),
      },
      { key: 'courses', title: 'Courses', head: ['ID', 'Title', 'Category', 'Hours', 'Mentor', 'Batch', 'Status'], rows: this.courses.items().filter(c => !c.deleted).map(c => [c.id, c.title, c.category, c.hours, c.trainer, c.batches.join(', '), c.status]) },
      { key: 'enrollment', title: 'Enrollments', head: ['ID', 'Student ID', 'Student', 'Course', 'Batch', 'Enrolled on', 'Status'], rows: this.enrollment.items().map(e => [e.id, e.sid, e.name, e.course, e.batch, e.on, e.status]) },
      { key: 'learning', title: 'Learning progress', head: ['Student ID', 'Student', 'Course', 'Progress %', 'Materials', 'Status'], rows: this.learning.items().map(l => [l.sid, l.name, l.course, l.progress, l.mats, l.status]) },
      { key: 'assessments', title: 'Assessments', head: ['ID', 'Type', 'Title', 'Course', 'Max', 'Pass', 'Attempts', 'Due', 'Status'], rows: this.assessments.items().map(a => [a.id, a.type, a.title, a.course, a.max, a.pass, a.attempts, a.due, a.status]) },
      { key: 'certificates', title: 'Certificates', head: ['Certificate no', 'Student ID', 'Student', 'Course', 'Score', 'Attendance', 'Issued', 'Status'], rows: this.certs.items().map(c => [c.number ?? '', c.student_id, c.name, c.course, c.score ?? '', c.attendance ?? '', c.issued_at ? c.issued_at.slice(0, 10) : '', c.status]) },
      { key: 'logs', title: 'Activity log', head: AUDIT_HEAD, rows: this.audit().map(auditRow) },
    ];
  });

  width(bar: Bar, max: number): number {
    return Math.round((bar.value / max) * 100);
  }

  download(r: ReportDef): void {
    saveBlob(new Blob([toCsv(r.head, r.rows)], { type: 'text/csv;charset=utf-8' }), `${r.key}-report-${fileStamp()}.csv`);
  }
}
