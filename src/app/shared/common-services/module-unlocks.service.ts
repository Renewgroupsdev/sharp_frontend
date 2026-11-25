import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiCrud } from '../../core/http/api-crud';
import { ModuleState } from './my-learning.service';

export interface ModuleUnlockRecord {
  id: number;
  student_id: string;
  name: string;
  course_id: number;
  course: string;
  chapter_id: number;
  module: string;
  reason: string;
  unlocked_by: string | null;
  created_at: string;
}

export interface UnlockPayload {
  student_id: string;
  chapter_id: number;
  reason: string;
}

/** The modules of one course with their lock state for a student. */
export interface CourseModules {
  course: { id: number; title: string };
  modules: ModuleState[];
}

/** /api/web/module-unlocks — a mentor (their own batch) or an admin opens a locked module early for one student. */
@Injectable({ providedIn: 'root' })
export class ModuleUnlocksApi extends ApiCrud<ModuleUnlockRecord, UnlockPayload> {
  constructor() { super(inject(HttpClient), 'module-unlocks', 'unlock', 'unlocks'); }

  /** Every module of every course the student takes, with its lock state: what can be unlocked. */
  async overview(studentId: string): Promise<CourseModules[]> {
    const url = `${this.baseUrl}/overview?student_id=${encodeURIComponent(studentId)}`;
    return (await this.call('get', url) as unknown as { courses: CourseModules[] }).courses;
  }
}
