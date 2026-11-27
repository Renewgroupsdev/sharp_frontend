import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MarkAttendancePayload {
  student_id: string;
  /** Backend statuses: Present (reported by the student), Manual (marked present by staff) or Absent. */
  status: 'Present' | 'Manual' | 'Absent';
  reason: string | null;
  date: string;
  lat?: number;
  lng?: number;
}

export interface AttendanceListFilter {
  batch_id?: number;
  college_id?: number;
  student_id?: string;
  date_from?: string;
  date_to?: string;
  status?: 'Present' | 'Manual' | 'Absent';
}

/** One row of GET /api/web/attendance/list. */
export interface AttendanceListRow {
  id: number;
  student_id: string;
  name: string;
  org: string | null;
  batch: string | null;
  date: string;
  status: 'Present' | 'Manual' | 'Absent';
  reason: string | null;
  marked_by_name: string | null;
  created_at: string;
}

export interface AttendanceMonthRow { month: string; label: string; working_days: number; present: number; pct: number }
export interface AttendanceCourseRow {
  course_id: number; course: string; start_date: string; end_date: string;
  working_days: number; elapsed_days: number; present: number; absent: number; pct: number; pct_so_far: number;
}
export interface AttendanceSummaryData { months: AttendanceMonthRow[]; courses: AttendanceCourseRow[] }

/** /api/web/attendance — staff and mentors list and mark attendance; one row per student and day. */
@Injectable({ providedIn: 'root' })
export class AttendanceApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/attendance`;

  /** Marks several students the same way for one day (POST attendance/bulk); resolves with how many were marked. */
  async markMany(payload: { student_ids: string[]; status: 'Present' | 'Manual' | 'Absent'; reason: string | null; date: string }): Promise<number> {
    return (await firstValueFrom(this.http.post<{ marked: number }>(`${environment.apiBaseUrl}/attendance/bulk`, payload))).marked;
  }

  async mark(payload: MarkAttendancePayload): Promise<void> {
    const res = await firstValueFrom(this.http.post<{ ok: boolean; message?: string }>(this.url, payload));
    if (res?.ok !== true) throw new Error(res?.message || 'Unexpected response from the server.');
  }

  /** Month-wise and per-course attendance percentages; your own, or a student's you may see (public id). */
  async summary(studentId?: string): Promise<AttendanceSummaryData> {
    const params = studentId ? new HttpParams().set('student_id', studentId) : undefined;
    return firstValueFrom(this.http.get<AttendanceSummaryData>(`${this.url}/summary`, { params }));
  }

  /** Attendance of many students; the server defaults to the last 90 days and scopes a mentor to their batch. */
  async list(filters: AttendanceListFilter = {}): Promise<AttendanceListRow[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params = params.set(key, String(value));
    const res = await firstValueFrom(this.http.get<{ ok: boolean; records: AttendanceListRow[] }>(`${this.url}/list`, { params }));
    if (res?.ok !== true) throw new Error('Unexpected response from the server.');
    return res.records;
  }
}
