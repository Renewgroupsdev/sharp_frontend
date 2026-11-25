import { Injectable, computed, inject } from '@angular/core';
import { MODULES } from '../../core/data/programme-data';
import { LearnerStateService } from '../../shared/common-services/learner-state.service';

export type ModuleState = 'done' | 'current' | 'locked';

/** Derived progress of the demo student (module unlocking, opened materials, attendance %). */
@Injectable({ providedIn: 'root' })
export class StudentProgress {
  private readonly learner = inject(LearnerStateService);
  readonly modules = MODULES;

  readonly passedCount = computed(() => MODULES.filter(m => this.learner.state().passed[m.id]).length);
  readonly progress = computed(() => Math.round((this.passedCount() / MODULES.length) * 100));
  readonly currentModule = computed(() => MODULES.find(m => this.modState(m.id) === 'current') ?? MODULES[MODULES.length - 1]);
  readonly attendancePct = computed(() => {
    const a = this.learner.state().attendance;
    return a.length ? Math.round((a.filter(x => x.s !== 'Absent').length / a.length) * 100) : 0;
  });

  modState(id: number): ModuleState {
    const p = this.learner.state().passed;
    if (id === 1) return p[1] !== undefined ? 'done' : 'current';
    if (p[id] !== undefined) return 'done';
    return p[id - 1] !== undefined ? 'current' : 'locked';
  }

  matsOpened(id: number): number {
    const m = MODULES.find(x => x.id === id);
    const o = this.learner.state().opened;
    return m ? m.mats.filter((_, i) => o[`${id}-${i}`]).length : 0;
  }

  isOpened(id: number, idx: number): boolean {
    return !!this.learner.state().opened[`${id}-${idx}`];
  }

  markOpened(id: number, idx: number): void {
    this.learner.update(s => ({ ...s, opened: { ...s.opened, [`${id}-${idx}`]: true } }));
  }

  score(id: number): number | undefined {
    return this.learner.state().passed[id];
  }

  recordPass(id: number, pct: number): void {
    this.learner.update(s => ({ ...s, passed: { ...s.passed, [id]: pct } }));
  }
}
