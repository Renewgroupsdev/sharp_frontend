import { Injectable, inject } from '@angular/core';
import { LocalCollection } from '../../core/data/local-collection';
import { LearningInput, LearningRecord, LearningStatus, ModuleProgress } from '../models/learning.model';
import { CoursesService } from './courses.service';
import { LearningApi, LearningApiResource } from './learning-api.service';

export const learningStatusOf = (progress: number): LearningStatus => (progress >= 100 ? 'Completed' : progress > 0 ? 'In progress' : 'Not started');

export const recordId = (sid: string, courseId: number | string): string => `${sid}|${courseId}`;

function toRecord(r: LearningApiResource): LearningRecord {
  return {
    id: recordId(r.student_id, r.course_id),
    sid: r.student_id,
    name: r.name,
    org: r.org ?? '—',
    course: r.course,
    courseId: r.course_id,
    progress: r.progress,
    mats: r.materials,
    last: r.last_accessed ?? '',
    status: learningStatusOf(r.progress),
  };
}

/**
 * Learning progress per student and course, stored through the Laravel learning API. A student appears for every course
 * mapped to their batch; the signal collection is a cache the screens read and every write goes to the API first.
 */
@Injectable({ providedIn: 'root' })
export class LearningService extends LocalCollection<LearningRecord> {
  private readonly api = inject(LearningApi);
  private readonly courses = inject(CoursesService);

  private loading?: Promise<void>;

  constructor() { super('learning-records', () => [], 'LRN', 4); }

  /** Loads every enrolled student's progress. Concurrent calls share one request. */
  loadFromApi(): Promise<void> {
    this.loading ??= (async () => {
      try {
        this.replace((await this.api.list()).map(toRecord));
      } finally {
        this.loading = undefined;
      }
    })();
    return this.loading;
  }

  /** Adds or edits the record of a student in a course; the server rejects students who are not enrolled. */
  async save(input: LearningInput): Promise<LearningRecord> {
    const saved = toRecord(await this.api.save({
      student_id: input.sid,
      course_id: input.courseId,
      progress: Math.max(0, Math.min(100, Math.round(Number(input.progress) || 0))),
      materials_completed: Math.max(0, Math.round(Number(input.mats) || 0)),
      last_accessed_at: input.last || null,
    }));
    this.upsert(saved);
    return saved;
  }

  /** Sets the record back to 0% / Not started. The student stays enrolled. */
  async resetProgress(id: string): Promise<void> {
    const rec = this.get(id);
    if (!rec) throw new Error('Record not found. Please reload the list.');
    this.upsert(toRecord(await this.api.reset(rec.sid, rec.courseId)));
  }

  private upsert(rec: LearningRecord): void {
    if (this.get(rec.id)) this.update(rec.id, rec); else this.add(rec, false);
  }

  courseTitles(): string[] {
    return this.courses.courseTitles();
  }

  /** Modules with the lessons the student has really completed. */
  async moduleReport(rec: LearningRecord): Promise<ModuleProgress[]> {
    const rows = await this.api.moduleReport(rec.sid, rec.courseId);
    return rows.map(r => ({ name: r.name, done: r.done, total: r.total, pct: r.pct, status: r.status as LearningStatus }));
  }
}
