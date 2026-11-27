import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** One piece of mentor feedback on a student in a course; `topic` is a lesson id, or '' for the course as a whole. */
export interface CourseFeedbackRow {
  id: number;
  course_id: number;
  student_id: string;
  topic: string;
  text: string;
  by: string;
  created_at: string;
}

/** /api/web/course-feedback: a student reads their own feedback; staff and mentors write it. */
@Injectable({ providedIn: 'root' })
export class CourseFeedbackApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/course-feedback`;

  async list(courseId: number, studentId?: string): Promise<CourseFeedbackRow[]> {
    let params = new HttpParams().set('course_id', String(courseId));
    if (studentId) params = params.set('student_id', studentId);
    return (await firstValueFrom(this.http.get<{ feedback: CourseFeedbackRow[] }>(this.url, { params }))).feedback;
  }

  async add(body: { course_id: number; student_id: string; lesson_id?: number | null; text: string }): Promise<void> {
    await firstValueFrom(this.http.post(this.url, body));
  }
}
