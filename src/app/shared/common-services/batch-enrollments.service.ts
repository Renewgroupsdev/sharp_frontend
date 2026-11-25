import { Injectable, inject } from '@angular/core';
import { LocalCollection } from '../../core/data/local-collection';
import { ApiUserResource } from '../models/api.model';
import {
  BatchEnrollment, CertificateState, EnrollmentDetail, EnrollmentEvent, EnrollmentMember, ImportResult,
} from '../models/batch-enrollment.model';
import {
  BatchEnrollmentsApi, EnrollmentApiResource, EnrollmentDetailApi, EnrollmentEventApi, EnrollmentMembers,
} from './batch-enrollments-api.service';
import { BatchesService, isoToBatchDate } from './batches.service';
import { CertificatesApi } from './certificates-api.service';
import { CoursesService } from './courses.service';

function toEnrollment(r: EnrollmentApiResource): BatchEnrollment {
  return {
    id: String(r.id),
    courseId: r.course_id,
    code: r.course_code,
    course: r.course,
    batchId: r.batch_id,
    batch: r.batch,
    start: isoToBatchDate(r.start_date ?? ''),
    end: isoToBatchDate(r.end_date ?? ''),
    startIso: r.start_date ?? '',
    endIso: r.end_date ?? '',
    students: r.students_count,
    mentors: r.mentors_count,
    status: r.status,
  };
}

const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export const toEvent = (e: EnrollmentEventApi): EnrollmentEvent => ({
  id: e.id, courseId: e.course_id, course: e.course, batchId: e.batch_id, batch: e.batch, event: e.event, source: e.source, actor: e.actor ?? 'System', at: stamp(e.created_at),
});

export const toMember = (u: ApiUserResource): EnrollmentMember => ({
  id: u.id, name: u.name, org: u.org ?? '', mobile: u.mobile ?? '', email: u.email ?? '', status: u.status, specialist: u.specialist ?? '',
});

function toDetail(d: EnrollmentDetailApi): EnrollmentDetail {
  return {
    enrollment: toEnrollment(d.enrollment),
    lessonsTotal: d.lessons_total,
    summary: {
      students: d.summary.students, completed: d.summary.completed, avgProgress: d.summary.avg_progress, avgAttendance: d.summary.avg_attendance,
      avgQuiz: d.summary.avg_quiz, certificatesIssued: d.summary.certificates_issued, certificatesPending: d.summary.certificates_pending,
    },
    students: d.students.map(s => ({
      id: s.student_id, name: s.name, org: s.org ?? '—', status: s.status, progress: s.progress, lessonsDone: s.lessons_done,
      lastAccessed: s.last_accessed ?? '', attendance: s.attendance_rate, quiz: s.quiz_avg, certificate: s.certificate,
    })),
    mentors: d.mentors.map(toMember),
    history: d.history.map(toEvent),
  };
}

/**
 * Enrollment management: courses run for batches, with the student and mentor counts, stored through the Laravel
 * enrollments API. The signal collection is a cache the screens read; every write goes to the API first.
 */
@Injectable({ providedIn: 'root' })
export class BatchEnrollmentsService extends LocalCollection<BatchEnrollment> {
  private readonly api = inject(BatchEnrollmentsApi);
  private readonly certificates = inject(CertificatesApi);
  private readonly courses = inject(CoursesService);
  private readonly batches = inject(BatchesService);

  private loading?: Promise<void>;

  constructor() { super('batch-enrollments', () => [], 'ENR', 4); }

  /** Loads every enrollment the signed-in role may see. Concurrent calls share one request. */
  loadFromApi(): Promise<void> {
    this.loading ??= (async () => {
      try {
        this.replace((await this.api.list()).map(toEnrollment));
      } finally {
        this.loading = undefined;
      }
    })();
    return this.loading;
  }

  /** Enrols the batches in the courses and returns how many pairs were new. */
  async enroll(courseIds: number[], batchIds: number[]): Promise<number> {
    const before = this.items().length;
    this.merge(await this.api.enroll({ course_ids: courseIds, batch_ids: batchIds }));
    return this.items().length - before;
  }

  /** Gives the target batches every course the selected enrollments run; returns how many pairs were new. */
  async copy(ids: string[], batchIds: number[]): Promise<number> {
    const created = await this.api.copy(ids.map(Number), batchIds);
    await this.reload();
    return created;
  }

  async removeMany(ids: string[]): Promise<number> {
    const removed = await this.api.removeMany(ids.map(Number));
    this.replace(this.items().filter(e => !ids.includes(e.id)));
    this.syncOthers();
    return removed;
  }

  removeEnrollment(id: string): Promise<number> {
    return this.removeMany([id]);
  }

  /** Previews (dry run) or performs an import of (course, batch) rows. */
  async importRows(rows: { course: string; batch: string }[], dryRun: boolean): Promise<ImportResult> {
    const r = await this.api.importRows(rows, dryRun);
    if (!dryRun && r.summary.ok) await this.reload();
    return { dryRun: r.dry_run, summary: r.summary, rows: r.rows };
  }

  /** The students and mentors behind a count, loaded when the count is opened. */
  async members(id: string): Promise<{ students: EnrollmentMember[]; mentors: EnrollmentMember[] }> {
    const m: EnrollmentMembers = await this.api.members(id);
    return { students: m.students.map(toMember), mentors: m.mentors.map(toMember) };
  }

  async detail(id: string): Promise<EnrollmentDetail> {
    return toDetail(await this.api.detail(id));
  }

  async history(): Promise<EnrollmentEvent[]> {
    return (await this.api.history()).map(toEvent);
  }

  /** Creates a Pending certificate for every student who finished the course and has none; returns how many. */
  generateCertificates(id: string): Promise<number> {
    return this.api.generateCertificates(id);
  }

  async issueCertificate(certificateId: number): Promise<{ status: CertificateState; number: string | null }> {
    const c = await this.certificates.issue(certificateId);
    return { status: c.status, number: c.number };
  }

  async rejectCertificate(certificateId: number): Promise<{ status: CertificateState; number: string | null }> {
    const c = await this.certificates.reject(certificateId);
    return { status: c.status, number: c.number };
  }

  private merge(rows: EnrollmentApiResource[]): void {
    for (const r of rows.map(toEnrollment)) {
      if (this.get(r.id)) this.update(r.id, r); else this.add(r, false);
    }
    this.syncOthers();
  }

  private async reload(): Promise<void> {
    await this.loadFromApi();
    this.syncOthers();
  }

  /** The course and batch lists show their own mapping, so refresh them after a change. */
  private syncOthers(): void {
    this.courses.loadFromApi().catch(() => undefined);
    this.batches.loadBatches().catch(() => undefined);
  }
}
