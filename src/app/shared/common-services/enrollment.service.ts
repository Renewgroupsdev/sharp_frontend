import { Injectable, computed, inject } from '@angular/core';
import { EnrollmentRecord } from '../models/course.model';
import { BatchesService } from './batches.service';
import { CoursesService } from './courses.service';
import { UsersService } from './users.service';

/**
 * Student-to-course enrollment, derived and never stored: a course is mapped to batches, and every student
 * in a mapped batch is enrolled in it. Moving a student to another batch, or mapping a course to a batch,
 * changes the enrollment immediately.
 */
@Injectable({ providedIn: 'root' })
export class EnrollmentService {
  private readonly courses = inject(CoursesService);
  private readonly users = inject(UsersService);
  private readonly batches = inject(BatchesService);

  readonly items = computed<EnrollmentRecord[]>(() => {
    const students = this.users.students();
    const starts = new Map(this.batches.items().map(b => [b.n, b.start]));
    const out: EnrollmentRecord[] = [];
    for (const c of this.courses.live()) {
      const seen = new Set<string>();
      for (const batch of c.batches) {
        for (const s of students) {
          if (s.b !== batch || seen.has(s.id)) continue;
          seen.add(s.id);
          out.push({ id: `${c.id}:${s.id}`, sid: s.id, name: s.n, course: c.title, batch, on: starts.get(batch) ?? '', status: 'Enrolled', progress: 0 });
        }
      }
    }
    return out;
  });

  /** Students enrolled in a course through its batches. */
  forCourse(title: string): EnrollmentRecord[] { return this.items().filter(e => e.course === title); }

  isEnrolled(sid: string, course: string): boolean {
    return this.items().some(e => e.sid === sid && e.course === course);
  }
}
