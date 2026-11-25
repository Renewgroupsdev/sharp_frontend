import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiCrud } from '../../core/http/api-crud';
import { AttendanceChoice } from '../models/attendance.model';

export interface AttendanceRequestApiResource {
  id: number;
  student_id: string;
  name: string;
  org: string | null;
  batch: string | null;
  date: string;
  requested_status: AttendanceChoice;
  reason: string | null;
  status: 'Pending' | 'Resolved';
  decision: AttendanceChoice | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  requested_at: string;
}

export interface AttendanceRequestPayload {
  status: AttendanceChoice;
  reason: string | null;
}

/** /api/web/attendance-requests — students report Present / Absent for today; staff and mentors mark the final status. The list is scoped per role by the server. */
@Injectable({ providedIn: 'root' })
export class AttendanceRequestsApi extends ApiCrud<AttendanceRequestApiResource, AttendanceRequestPayload> {
  constructor() { super(inject(HttpClient), 'attendance-requests', 'request', 'requests'); }

  /** The list plus the server's current day (the day a student's report counts for). */
  async fetch(): Promise<{ today: string; requests: AttendanceRequestApiResource[] }> {
    const res = await this.call('get', this.baseUrl) as unknown as { today: string; requests: AttendanceRequestApiResource[] };
    return { today: res.today, requests: res.requests };
  }

  /** Marks the final attendance status of a report; marking again simply changes it. */
  async mark(id: number | string, status: AttendanceChoice, note?: string): Promise<AttendanceRequestApiResource> {
    return this.pick<AttendanceRequestApiResource>(await this.call('post', this.url(id, '/mark'), { status, note: note || null }), 'request');
  }
}
