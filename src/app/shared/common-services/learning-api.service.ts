import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiCrud } from '../../core/http/api-crud';

export interface LearningApiResource {
  student_id: string;
  name: string;
  org: string | null;
  course_id: number;
  course: string;
  progress: number;
  materials: number;
  last_accessed: string | null;
  status: string;
}

export interface ModuleReportRow {
  name: string;
  done: number;
  total: number;
  pct: number;
  status: string;
}

export interface LearningPayload {
  student_id: string;
  course_id: number;
  progress: number;
  materials_completed: number;
  last_accessed_at: string | null;
}

/** /api/web/learning — the list is derived from batch-to-course mapping; one stored row per (student, course). */
@Injectable({ providedIn: 'root' })
export class LearningApi extends ApiCrud<LearningApiResource, LearningPayload> {
  constructor() { super(inject(HttpClient), 'learning', 'record', 'records'); }

  /** Add or edit: the server keeps a single row per student and course. */
  async save(payload: LearningPayload): Promise<LearningApiResource> {
    return this.pick<LearningApiResource>(await this.call('put', this.baseUrl, payload), 'record');
  }

  /** Per-module breakdown from the student's real lesson completions. */
  async moduleReport(studentId: string, courseId: number): Promise<ModuleReportRow[]> {
    const url = `${this.baseUrl}/report?student_id=${encodeURIComponent(studentId)}&course_id=${courseId}`;
    return this.pick<ModuleReportRow[]>(await this.call('get', url), 'modules');
  }

  /** Clears the stored progress; the student stays enrolled. */
  async reset(studentId: string, courseId: number): Promise<LearningApiResource> {
    const url = `${this.baseUrl}?student_id=${encodeURIComponent(studentId)}&course_id=${courseId}`;
    return this.pick<LearningApiResource>(await this.call('delete', url), 'record');
  }
}
