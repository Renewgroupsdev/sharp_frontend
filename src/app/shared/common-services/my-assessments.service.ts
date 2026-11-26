import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AssessmentSubmission, MyAssessment, MyAssessmentDetail, QuizOutcome, QuizReview, StartedAttempt, SubmittedAnswer } from '../models/my-assessment.model';

/** /api/web/my/assessments — the signed-in student's quizzes. Every answer is marked on the server. */
@Injectable({ providedIn: 'root' })
export class MyAssessmentsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/my/assessments`;

  private async unwrap<T>(request: Promise<{ ok: boolean } & T>): Promise<T> {
    const res = await request;
    if (res?.ok !== true) throw new Error('Unexpected response from the server.');
    return res;
  }

  async list(): Promise<MyAssessment[]> {
    return (await this.unwrap(firstValueFrom(this.http.get<{ ok: boolean; assessments: MyAssessment[] }>(this.base)))).assessments;
  }

  detail(id: number | string): Promise<MyAssessmentDetail> {
    return this.unwrap(firstValueFrom(this.http.get<{ ok: boolean } & MyAssessmentDetail>(`${this.base}/${id}`)));
  }

  /** Starts an attempt, or resumes the one in progress, and returns its questions. */
  start(id: number | string): Promise<StartedAttempt> {
    return this.unwrap(firstValueFrom(this.http.post<{ ok: boolean } & StartedAttempt>(`${this.base}/${id}/start`, {})));
  }

  async submit(id: number | string, attemptId: number, answers: SubmittedAnswer[]): Promise<QuizOutcome> {
    return (await this.unwrap(firstValueFrom(this.http.post<{ ok: boolean; result: QuizOutcome }>(`${this.base}/${id}/submit`, { attempt_id: attemptId, answers })))).result;
  }

  review(id: number | string, attemptId?: number): Promise<QuizReview> {
    const query = attemptId ? `?attempt_id=${attemptId}` : '';
    return this.unwrap(firstValueFrom(this.http.get<{ ok: boolean } & QuizReview>(`${this.base}/${id}/review${query}`)));
  }

  async assignmentSubmissions(id: number | string): Promise<AssessmentSubmission[]> {
    return (await this.unwrap(firstValueFrom(this.http.get<{ ok: boolean; submissions: AssessmentSubmission[] }>(`${this.base}/${id}/submissions`)))).submissions;
  }

  /** Takes back one of the student's own versions (only while it is waiting and before the deadline). */
  async deleteSubmission(id: number | string, submissionId: number): Promise<void> {
    await this.unwrap(firstValueFrom(this.http.delete<{ ok: boolean }>(`${this.base}/${id}/submissions/${submissionId}`)));
  }

  async submitAssignment(id: number | string, content: string, files: File[]): Promise<AssessmentSubmission> {
    const body = new FormData();
    if (content.trim()) body.append('content', content.trim());
    files.forEach(file => body.append('files[]', file, file.name));
    return (await this.unwrap(firstValueFrom(this.http.post<{ ok: boolean; submission: AssessmentSubmission }>(`${this.base}/${id}/submissions`, body)))).submission;
  }

}

/** The student's assessments, cached for the list screen. */
@Injectable({ providedIn: 'root' })
export class MyAssessmentsService {
  private readonly api = inject(MyAssessmentsApi);

  readonly items = signal<MyAssessment[]>([]);
  readonly loaded = signal(false);

  async load(): Promise<void> {
    this.items.set(await this.api.list());
    this.loaded.set(true);
  }
}
