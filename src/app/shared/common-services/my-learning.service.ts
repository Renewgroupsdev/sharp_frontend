import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCrud } from '../../core/http/api-crud';
import { Course } from '../models/course.model';
import { CourseApiResource } from './courses-api.service';
import { toCourse } from './courses.service';

export interface ProgressSummary {
  lessons_total: number;
  lessons_done: number;
  progress: number;
  status: string;
  last_accessed: string | null;
}

export interface MyCourseSummary extends ProgressSummary {
  id: number;
  code: string;
  title: string;
  category: string | null;
  hours: number;
  mentors: string[];
  level: string;
  mode: string;
  thumbnail?: string | null;
}

/** Progress after an open / complete call: the new summary and every completed lesson id of the course. */
export interface LearnState {
  progress: ProgressSummary;
  completed_lesson_ids: number[];
}

/** A quiz inside a module: finishing the module needs it passed. */
export interface ModuleQuiz {
  /** 'quiz' or 'assessment'. */
  type?: string;
  /** False until the lesson (or every lesson of the module) it follows is completed. */
  available?: boolean;
  reason?: string | null;
  id: number;
  title: string;
  best_percent: number | null;
  min_percent: number;
  passed: boolean;
}

/** Where a module stands for the student: locked until the one before it is finished, or opened early by a mentor. */
export interface ModuleState {
  chapter_id: number;
  name: string;
  position: number;
  locked: boolean;
  /** Why it is locked, in words. */
  reason: string | null;
  complete: boolean;
  unlocked_early: boolean;
  lessons_done: number;
  lessons_total: number;
  /** Each lesson in order: locked until the lesson before it is completed. */
  lessons: { id: number; locked: boolean; reason: string | null }[];
  quizzes: ModuleQuiz[];
}

export interface MyCourseDetail extends LearnState {
  course: Course;
  modules: ModuleState[];
}

/** /api/web/my/* — the signed-in student's own courses and lesson progress. */
@Injectable({ providedIn: 'root' })
export class MyLearningApi extends ApiCrud<MyCourseSummary, never> {
  private readonly lessonsUrl = `${environment.apiBaseUrl}/my/lessons`;

  constructor() { super(inject(HttpClient), 'my/courses', 'course', 'courses'); }

  async detail(id: number | string): Promise<MyCourseDetail> {
    const res = await this.call('get', this.url(id)) as unknown as { course: CourseApiResource; modules: ModuleState[] } & LearnState;
    return { course: toCourse(res.course), progress: res.progress, completed_lesson_ids: res.completed_lesson_ids, modules: res.modules };
  }

  open(lessonId: number | string): Promise<LearnState> { return this.post(lessonId, 'open'); }

  complete(lessonId: number | string): Promise<LearnState> { return this.post(lessonId, 'complete'); }

  private async post(lessonId: number | string, action: 'open' | 'complete'): Promise<LearnState> {
    const res = await firstValueFrom(this.http.post<{ ok: boolean } & LearnState>(`${this.lessonsUrl}/${encodeURIComponent(String(lessonId))}/${action}`, {}));
    if (res?.ok !== true) throw new Error('Unexpected response from the server.');
    return { progress: res.progress, completed_lesson_ids: res.completed_lesson_ids };
  }
}

/** The student's enrolled courses with their progress. */
@Injectable({ providedIn: 'root' })
export class MyLearningService {
  private readonly api = inject(MyLearningApi);

  readonly courses = signal<MyCourseSummary[]>([]);
  readonly loaded = signal(false);

  async load(): Promise<void> {
    this.courses.set(await this.api.list());
    this.loaded.set(true);
  }

  /** Keeps the list card in step after a lesson is opened or completed in the player. */
  applyProgress(courseId: number, progress: ProgressSummary): void {
    this.courses.update(list => list.map(c => (c.id === courseId ? { ...c, ...progress } : c)));
  }
}
