import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiAssessment, ApiQuestion, ApiQuestionGroup, ApiQuizResult, AssessmentPayload, QuestionPayload, SetupPayload,
} from '../models/assessment-api.model';
import { ApiOk } from '../models/api.model';
import { AssessmentSubmission } from '../models/my-assessment.model';
import { AttemptCounts, AttemptQuestion, QuizAttemptRow } from '../models/quiz-attempt.model';

export interface QuizResultPayload { assessment_id: number; student_id: number; marks: number; attempts?: number }

/** Typed client for the sharp-api quiz, assignment and assessment endpoints (`/api/web/...`). */
@Injectable({ providedIn: 'root' })
export class AssessmentsApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  private get<T>(path: string, filters: object = {}): Promise<ApiOk<T>> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string | number>;
    return firstValueFrom(this.http.get<ApiOk<T>>(`${this.base}/${path}`, { params }));
  }
  private post<T>(path: string, body: object | FormData): Promise<ApiOk<T>> {
    return firstValueFrom(this.http.post<ApiOk<T>>(`${this.base}/${path}`, body));
  }
  private put<T>(path: string, body: object): Promise<ApiOk<T>> {
    return firstValueFrom(this.http.put<ApiOk<T>>(`${this.base}/${path}`, body));
  }
  private del(path: string): Promise<ApiOk<{ message?: string }>> {
    return firstValueFrom(this.http.delete<ApiOk<{ message?: string }>>(`${this.base}/${path}`));
  }

  // Question groups
  getGroups = () => this.get<{ groups: ApiQuestionGroup[] }>('question-groups');
  createGroup = (title: string, type: string) => this.post<{ group: ApiQuestionGroup }>('question-groups', { title, type });
  updateGroup = (id: string, title: string) => this.put<{ group: ApiQuestionGroup }>(`question-groups/${id}`, { title });
  deleteGroup = (id: string) => this.del(`question-groups/${id}`);

  // Question bank
  getQuestions = (filters: { group_id?: number; type?: string; q?: string } = {}) => this.get<{ questions: ApiQuestion[] }>('questions', filters);
  createQuestion = (body: QuestionPayload) => this.post<{ question: ApiQuestion }>('questions', body);
  updateQuestion = (id: string, body: QuestionPayload) => this.put<{ question: ApiQuestion }>(`questions/${id}`, body);
  deleteQuestion = (id: string) => this.del(`questions/${id}`);

  // Quizzes, assignments and assessments
  getAssessments = (filters: { type?: string; course?: string; status?: string; q?: string } = {}) => this.get<{ assessments: ApiAssessment[] }>('assessments', filters);
  createAssessment = (body: AssessmentPayload) => this.post<{ assessment: ApiAssessment }>('assessments', body);
  updateAssessment = (id: string, body: AssessmentPayload) => this.put<{ assessment: ApiAssessment }>(`assessments/${id}`, body);
  saveSetup = (id: string, body: SetupPayload) => this.put<{ assessment: ApiAssessment }>(`assessments/${id}/setup`, body);
  deleteAssessment = (id: string) => this.del(`assessments/${id}`);

  /** The instructor's document. Staff upload / remove it; staff and enrolled students read it (the API checks who may). */
  uploadAttachment = (id: string, file: File) => {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.post<{ assessment: ApiAssessment }>(`assessments/${id}/attachment`, body);
  };
  deleteAttachment = (id: string) => firstValueFrom(this.http.delete<ApiOk<{ assessment: ApiAssessment }>>(`${this.base}/assessments/${id}/attachment`));
  attachmentBlob = (id: string | number) => firstValueFrom(this.http.get(`${this.base}/assessments/${id}/attachment`, { responseType: 'blob' }));
  renameCourse = (from: string, to: string) => this.put<{ updated: number }>('assessments/rename-course', { from, to });

  // Quiz report
  getResults = (filters: { assessment_id?: number; course?: string; q?: string } = {}) => this.get<{ results: ApiQuizResult[] }>('quiz-results', filters);
  recordResult = (body: QuizResultPayload) => this.post<{ result: ApiQuizResult }>('quiz-results', body);

  // Quiz attempts (staff and mentors; mentors only get their own batch)
  getQuizAttempts = (filters: { assessment_id?: number; student_id?: number; type?: string; outcome?: string; q?: string; per_page?: number } = {}) =>
    this.get<{ attempts: QuizAttemptRow[]; counts: AttemptCounts; meta: { current_page: number; last_page: number; per_page: number; total: number } }>('quiz-attempts', filters);
  getQuizAttempt = (id: number) => this.get<{ attempt: QuizAttemptRow; questions: AttemptQuestion[] }>(`quiz-attempts/${id}`);

  gradeQuizAnswer = (attemptId: number, body: { question_id: number; marks: number; feedback?: string }) =>
    this.post<{ attempt: QuizAttemptRow; questions: AttemptQuestion[] }>(`quiz-attempts/${attemptId}/grade`, body);

  getSubmissions = (filters: { assessment_id?: number; status?: string; q?: string; per_page?: number } = {}) =>
    this.get<{ submissions: AssessmentSubmission[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }>('submissions', filters);
  getSubmission = (id: number) => this.get<{ submission: AssessmentSubmission }>(`submissions/${id}`);
  /** Opens a student's file for review without offering it as a download (mentors, OB). */
  viewAttachment = (id: number) => firstValueFrom(this.http.get(`${this.base}/submission-attachments/${id}/view`, { responseType: 'blob' }));
  updateSubmission = (id: number, content: string) => this.put<{ submission: AssessmentSubmission }>(`submissions/${id}`, { content });
  deleteSubmission = (id: number) => this.del(`submissions/${id}`);
  downloadAttachment = (id: number) => firstValueFrom(this.http.get(`${this.base}/submission-attachments/${id}/download`, { responseType: 'blob' }));
  markSubmissionUnderReview = (id: number) => this.post<{ submission: AssessmentSubmission }>(`submissions/${id}/review`, {});
  gradeSubmission = (id: number, body: { marks_obtained: number; feedback?: string; status?: 'graded' | 'returned' }) =>
    this.post<{ submission: AssessmentSubmission }>(`submissions/${id}/grade`, body);

}
