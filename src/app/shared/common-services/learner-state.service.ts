import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface AttendanceEntry { d: string; t: string; s: 'Present' | 'Manual' | 'Absent' | string; how: string; }

export interface LearnerState {
  /** Geofence toggle of the demo: is the student inside the Chamber building. */
  inside: boolean;
  /** Opened materials, keyed "<moduleId>-<materialIndex>". */
  opened: Record<string, boolean>;
  /** Passed module id -> score. A module is unlocked when the previous one is passed (or a mentor unlocks it). */
  passed: Record<number, number>;
  attendance: AttendanceEntry[];
}

const KEY = environment.storagePrefix + 'learner';

const DEFAULT_STATE = (): LearnerState => ({
  inside: true,
  opened: {},
  passed: {},
  attendance: [
    { d: '06 Sep 2026', t: '9:34 AM', s: 'Present', how: 'Geofence · Hall A' },
    { d: '31 Aug 2026', t: '9:28 AM', s: 'Present', how: 'Geofence · Hall A' },
    { d: '24 Aug 2026', t: '—', s: 'Manual', how: 'Marked by mentor · medical' },
    { d: '17 Aug 2026', t: '9:41 AM', s: 'Present', how: 'Geofence · Hall B' },
    { d: '10 Aug 2026', t: '—', s: 'Absent', how: 'No entry recorded' },
  ],
});

/** The demo student's progress (opened materials, passed modules, attendance), shared by the student and mentor screens. */
@Injectable({ providedIn: 'root' })
export class LearnerStateService {
  readonly state = signal<LearnerState>(this.load());

  private load(): LearnerState {
    try { const raw = localStorage.getItem(KEY); if (raw) return { ...DEFAULT_STATE(), ...JSON.parse(raw) }; } catch { /* use defaults */ }
    return DEFAULT_STATE();
  }

  update(fn: (s: LearnerState) => LearnerState): void {
    const next = fn(this.state());
    this.state.set(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  }

  reset(): void {
    this.update(() => DEFAULT_STATE());
  }
}
