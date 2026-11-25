import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiCrud } from '../../core/http/api-crud';

export interface LessonApiResource {
  id: number;
  name: string;
  duration_minutes: number;
  host: string;
  url?: string | null;
  content?: string | null;
  privacy: string;
  description?: string | null;
  file_name?: string | null;
  file_size?: string | null;
}

export interface ChapterApiResource {
  id: number;
  name: string;
  description?: string | null;
  status?: string;
  lessons: LessonApiResource[];
}

export interface CourseApiResource {
  id: number;
  code: string;
  title: string;
  category_id: number;
  category?: string;
  /** Batches the course runs for; their students are its enrolled students. */
  batches?: { id: number; name: string }[];
  hours: number;
  mentors: string[];
  mode: string;
  level: string;
  scope: string;
  status: string;
  description?: string | null;
  outcomes?: string | null;
  requirements?: string | null;
  thumbnail?: string | null;
  deleted_at?: string | null;
  chapters?: ChapterApiResource[];
}

/** Chapter / lesson ids are sent only when they are server ids, so new rows are inserted and old ones updated in place. */
export interface ChapterPayload {
  id?: number;
  name: string;
  description?: string | null;
  status?: string;
  lessons: {
    id?: number;
    name: string;
    duration_minutes: number;
    host: string;
    url?: string | null;
    content?: string | null;
    privacy: string;
    description?: string | null;
    file_name?: string | null;
    file_size?: string | null;
  }[];
}

export interface CoursePayload {
  title: string;
  course_category_id: number;
  batch_ids: number[];
  hours: number;
  mentors: string[];
  mode: string;
  level: string;
  scope: string;
  status: string;
  description: string;
  outcomes: string;
  requirements: string;
  thumbnail: string | null;
  chapters?: ChapterPayload[];
}

export interface CategoryApiResource {
  id: number;
  name: string;
  description?: string | null;
  status: 'Active' | 'Inactive';
  course_count?: number;
}

export interface CategoryPayload {
  name: string;
  description: string;
  status: string;
}

/** /api/web/courses — CRUD plus the trash, curriculum and filter endpoints. */
@Injectable({ providedIn: 'root' })
export class CoursesApi extends ApiCrud<CourseApiResource, CoursePayload> {
  constructor() { super(inject(HttpClient), 'courses', 'course', 'courses'); }

  /** Soft-deleted courses (staff only). */
  trashed(): Promise<CourseApiResource[]> { return this.list({ trashed: 1 }); }

  async replaceChapters(id: number | string, chapters: ChapterPayload[]): Promise<CourseApiResource> {
    return this.pick<CourseApiResource>(await this.call('put', this.url(id, '/chapters'), { chapters }), 'course');
  }

  async restore(id: number | string): Promise<CourseApiResource> {
    return this.pick<CourseApiResource>(await this.call('post', this.url(id, '/restore')), 'course');
  }

  /** Permanently deletes a course that is already in the trash. */
  purge(id: number | string): Promise<string | undefined> { return this.remove(id, '/purge'); }
}

/** /api/web/course-categories */
@Injectable({ providedIn: 'root' })
export class CourseCategoriesApi extends ApiCrud<CategoryApiResource, CategoryPayload> {
  constructor() { super(inject(HttpClient), 'course-categories', 'category', 'categories'); }
}
