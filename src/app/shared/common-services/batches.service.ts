import { Injectable, Injector, inject } from '@angular/core';
import { LocalCollection } from '../../core/data/local-collection';
import { SEED_BATCHES } from '../../core/data/seed';
import { BatchInput, BatchRecord } from '../models/institute.model';
import { CoursesService } from './courses.service';
import { ActivityLogService } from './activity-log.service';
import { BatchApiResource, BatchPayload, BatchesApi } from './batch-api.service';
import { InstitutesService } from './institutes.service';
import { UsersService } from './users.service';

const MODULE = 'Institute Management';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Programme batches (schedule, seats, mentors), stored through the Laravel batches API. */
@Injectable({ providedIn: 'root' })
export class BatchesService extends LocalCollection<BatchRecord> {
  private readonly users = inject(UsersService);
  private readonly log = inject(ActivityLogService);
  private readonly api = inject(BatchesApi);
  private readonly courses = inject(CoursesService);
  // Resolved lazily: InstitutesService already depends on this service.
  private readonly injector = inject(Injector);

  private loadingPromise?: Promise<void>;

  constructor() { super('batches', () => SEED_BATCHES.map(b => ({ ...b })), 'SH-B', 2); }

  names(): string[] { return this.items().map(b => b.n); }

  /** Students currently assigned to the batch. */
  studentCount(b: BatchRecord): number { return this.users.students().filter(u => u.b === b.n).length; }

  /** Names of the students assigned to the batch, with their IDs. */
  studentNames(b: BatchRecord): string[] { return this.users.students().filter(u => u.b === b.n).map(u => `${u.n} (${u.id})`); }

  nameTaken(name: string, exceptId?: string): boolean {
    return this.items().some(x => x.id !== exceptId && x.n.toLowerCase() === name.trim().toLowerCase());
  }

  /** Convert API data to the existing frontend batch model. */
  private mapApiBatch(row: BatchApiResource): BatchRecord {
    return {
      id: String(row.id),
      n: row.name,
      start: isoToBatchDate(row.start_date ?? ''),
      end: isoToBatchDate(row.end_date ?? ''),
      seats: Number(row.seats) || 0,
      filled: Number(row.student_count) || 0,
      mentors: Number(row.mentors) || 0,
      st: row.status || 'enrolling',
      orgs: (row.colleges ?? []).map(c => c.name),
      courses: (row.courses ?? []).map(c => c.title),
    };
  }

  /** Convert form data to the Laravel batch API payload; institute names are matched to their ids. */
  private toApiPayload(input: BatchInput): BatchPayload {
    const institutes = this.injector.get(InstitutesService).items();
    return {
      name: input.n.trim(),
      start_date: batchDateToIso(input.start),
      end_date: batchDateToIso(input.end),
      seats: Number(input.seats),
      mentors: Number(input.mentors) || 0,
      status: input.st,
      college_ids: input.orgs
        .map(name => Number(institutes.find(o => o.n === name)?.id))
        .filter(id => Number.isFinite(id) && id > 0),
      course_ids: input.courses
        .map(title => Number(this.courses.byTitle(title)?.id))
        .filter(id => Number.isFinite(id) && id > 0),
    };
  }

  /** Load the batch list from Laravel. */
  loadBatches(): Promise<void> {
    if (this.loadingPromise) return this.loadingPromise;
    this.loadingPromise = (async () => {
      try {
        const response = await this.api.getBatches();
        if (response.ok !== true || !Array.isArray(response.batches)) throw new Error('Invalid batch list response from API.');
        this.replace(response.batches.map(row => this.mapApiBatch(row)));
      } finally {
        this.loadingPromise = undefined;
      }
    })();
    return this.loadingPromise;
  }

  /** Creates (no `id`) or updates a batch through the API. Renaming a batch also renames it on its users. Logs the change. */
  async saveBatch(input: BatchInput, id?: string): Promise<BatchRecord> {
    const old = id ? this.get(id) : undefined;
    if (id && !old) throw new Error('Batch not found. Please reload the list.');
    const payload = this.toApiPayload(input);
    const response = old ? await this.api.updateBatch(old.id, payload) : await this.api.createBatch(payload);
    if (response.ok !== true || !response.batch) throw new Error(`Unable to ${old ? 'update' : 'create'} batch.`);
    const rec = this.mapApiBatch(response.batch);
    if (old) {
      if (old.n !== rec.n) this.users.replace(this.users.items().map(u => (u.b === old.n ? { ...u, b: rec.n } : u)));
      this.update(old.id, rec);
    } else {
      this.add(rec);
    }
    this.log.record(MODULE, `${old ? 'Updated batch ' : 'Created batch '}${rec.n}`);
    // The course list shows its batches, so pick up the new mapping.
    this.courses.loadFromApi().catch(() => undefined);
    return rec;
  }

  /** Why the batch cannot be deleted, or null when it can. */
  deleteBlocker(b: BatchRecord): string | null {
    const n = this.studentCount(b);
    return n ? `${n} student(s) are in ${b.n} — move them first` : null;
  }

  async deleteBatch(id: string): Promise<void> {
    const b = this.get(id);
    if (!b) throw new Error('Batch not found.');
    const response = await this.api.deleteBatch(id);
    if (response.ok !== true) throw new Error(response.message || 'Unable to delete batch.');
    this.remove(id);
    this.log.record(MODULE, `Deleted batch ${b.n}`);
  }
}

/** "14 Jun 2026" -> "2026-06-14" for a date input; '' when it cannot be read. */
export function batchDateToIso(text: string): string {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(String(text).trim());
  const mi = m ? MONTHS.findIndex(x => x.toLowerCase() === m[2].toLowerCase()) : -1;
  return m && mi >= 0 ? `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

/** "2026-06-14" -> "14 Jun 2026", the format batches are stored in. */
export function isoToBatchDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}
