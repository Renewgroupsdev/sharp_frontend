import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { MODULES, TEAM } from '../../core/data/programme-data';
import { ActivityLogService } from './activity-log.service';
import { LearnerStateService } from './learner-state.service';
import { UsersService } from './users.service';

export interface GroupMember {
  id: string;
  n: string;
  /** College / institute. */
  c: string;
  r: string;
  i: string;
  col: string;
  /** Overall progress %. */
  p: number;
  /** Module ids with a passed assessment. */
  done: number[];
  /** Batch name. */
  b: string;
}

/** The mentor's group (students of the mentor's batch), their progress. */
@Injectable({ providedIn: 'root' })
export class MentorGroupService {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly learner = inject(LearnerStateService);
  private readonly log = inject(ActivityLogService);

  readonly teamName = 'Team Vaigai';

  constructor() {
    // The user list is not loaded by itself: without this the mentor pages show leftover demo data or nobody.
    if (this.auth.accessToken()) void this.users.refresh();
  }

  /** The mentor's assigned students: the API returns only the students of the batches that take the mentor's courses. */
  readonly members = computed<GroupMember[]>(() => {
    const passed = this.learner.state().passed;
    const students = this.users.students();
    const six = MODULES.length;
    return students.map(u => {
      const t = TEAM.find(x => x.n === u.n);
      const isPriya = u.n === 'Priya R';
      const p = isPriya ? Math.round(MODULES.filter(m => passed[m.id]).length / six * 100) : (t?.p ?? 0);
      const done = isPriya ? MODULES.filter(m => passed[m.id]).map(m => m.id) : MODULES.filter(m => m.id <= Math.round(p / 100 * six)).map(m => m.id);
      return { id: u.id, n: u.n, c: u.org, r: t?.r ?? 'Member', i: u.i || u.n.slice(0, 2).toUpperCase(), col: u.col, p, done, b: u.b };
    });
  });

  /** Module state for the demo learner, as on the student screens. */
  modState(id: number): 'done' | 'current' | 'locked' {
    const passed = this.learner.state().passed;
    if (passed[id]) return 'done';
    return id === 1 || passed[id - 1] ? 'current' : 'locked';
  }

  unlock(id: number): void {
    this.learner.update(s => ({ ...s, passed: { ...s.passed, [id - 1]: 60 } }));
    const me = this.auth.actor();
    this.log.record('Learning Management', `Module ${id} unlocked by override (${me.n}, ${me.id})`);
  }
}
