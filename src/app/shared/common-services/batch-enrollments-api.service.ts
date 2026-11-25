import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiCrud } from '../../core/http/api-crud';
import { ApiUserResource } from '../models/api.model';
import { EnrollmentStatus } from '../models/batch-enrollment.model';

export interface EnrollmentApiResource {
  id: number;
  course_id: number;
  course_code: string;
  course: string;
  batch_id: number;
  batch: string;
  start_date: string | null;
  end_date: string | null;
  students_count: number;
  mentors_count: number;
  status: EnrollmentStatus;
}

export interface EnrollmentPayload {
  course_ids: number[];
  batch_ids: number[];
}

export interface EnrollmentMembers {
  students: ApiUserResource[];
  mentors: ApiUserResource[];
}

export interface EnrollmentStudentApi {
  student_id: string;
  name: string;
  org: string | null;
  status: string;
  progress: number;
  lessons_done: number;
  last_accessed: string | null;
  attendance_rate: number | null;
  quiz_avg: number | null;
  certificate: { id: number; status: 'Pending' | 'Issued' | 'Rejected'; number: string | null } | null;
}

export interface EnrollmentEventApi {
  id: number;
  course_id: number;
  course: string;
  batch_id: number;
  batch: string;
  event: 'Enrolled' | 'Removed';
  source: string;
  note: string | null;
  actor: string | null;
  created_at: string;
}

export interface EnrollmentDetailApi {
  enrollment: EnrollmentApiResource;
  lessons_total: number;
  summary: {
    students: number; completed: number; avg_progress: number; avg_attendance: number | null; avg_quiz: number | null;
    certificates_issued: number; certificates_pending: number;
  };
  students: EnrollmentStudentApi[];
  mentors: ApiUserResource[];
  history: EnrollmentEventApi[];
}

export interface ImportApiResult {
  dry_run: boolean;
  summary: { ok: number; exists: number; error: number };
  rows: { line: number; course: string; batch: string; status: 'ok' | 'exists' | 'error'; message: string }[];
}

/** /api/web/enrollments — a course run for a batch: list, detail, history, enrol / copy / remove / import, and certificates. */
@Injectable({ providedIn: 'root' })
export class BatchEnrollmentsApi extends ApiCrud<EnrollmentApiResource, EnrollmentPayload> {
  constructor() { super(inject(HttpClient), 'enrollments', 'enrollment', 'enrollments'); }

  /** Enrols every batch in every course; pairs that already exist are left alone. */
  async enroll(payload: EnrollmentPayload): Promise<EnrollmentApiResource[]> {
    return this.pick<EnrollmentApiResource[]>(await this.call('post', `${this.baseUrl}/bulk`, payload), 'enrollments');
  }

  /** The students and mentors of the enrollment's batch. */
  async members(id: number | string): Promise<EnrollmentMembers> {
    const res = await this.call('get', this.url(id, '/members')) as unknown as EnrollmentMembers;
    return { students: res.students, mentors: res.mentors };
  }

  async detail(id: number | string): Promise<EnrollmentDetailApi> {
    return await this.call('get', this.url(id, '/detail')) as unknown as EnrollmentDetailApi;
  }

  async history(params: { course_id?: number; batch_id?: number } = {}): Promise<EnrollmentEventApi[]> {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
    const res = await this.call('get', `${this.baseUrl}/history${query ? '?' + query : ''}`) as unknown as { history: EnrollmentEventApi[] };
    return res.history;
  }

  /** Gives the target batches every course the selected enrollments run; resolves with how many are new. */
  async copy(enrollmentIds: number[], batchIds: number[]): Promise<number> {
    return (await this.call('post', `${this.baseUrl}/copy`, { enrollment_ids: enrollmentIds, batch_ids: batchIds }) as unknown as { created: number }).created;
  }

  async removeMany(ids: number[]): Promise<number> {
    return (await this.call('post', `${this.baseUrl}/remove`, { ids }) as unknown as { removed: number }).removed;
  }

  /** Rows of (course, batch); `dryRun` previews the outcome without writing. */
  async importRows(rows: { course: string; batch: string }[], dryRun: boolean): Promise<ImportApiResult> {
    return await this.call('post', `${this.baseUrl}/import`, { rows, dry_run: dryRun }) as unknown as ImportApiResult;
  }

  /** A Pending certificate for every student who finished the course and has none yet. */
  async generateCertificates(id: number | string): Promise<number> {
    return (await this.call('post', this.url(id, '/certificates')) as unknown as { created: number }).created;
  }
}
