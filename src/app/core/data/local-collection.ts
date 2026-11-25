import { signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * A list of records held in a signal and persisted to localStorage. Every SHARP module store builds on this,
 * so pages read `items()` in templates / computed values and re-render when anything changes.
 */
export class LocalCollection<T extends { id: string }> {
  private readonly key: string;
  readonly items = signal<T[]>([]);

  constructor(name: string, private readonly seed: () => T[], private readonly idPrefix = '', private readonly idWidth = 3) {
    this.key = environment.storagePrefix + name;
    this.items.set(this.load());
  }

  private load(): T[] {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed as T[]; }
    } catch { /* storage blocked or corrupt - fall back to the seed */ }
    const fresh = this.seed();
    this.write(fresh);
    return fresh;
  }

  private write(list: T[]): void {
    try { localStorage.setItem(this.key, JSON.stringify(list)); } catch { /* storage blocked */ }
  }

  private commit(list: T[]): void {
    this.items.set(list);
    this.write(list);
  }

  get(id: string): T | undefined {
    return this.items().find(x => x.id === id);
  }

  /** Next id such as `ORG-004`: highest numeric suffix + 1. */
  nextId(prefix = this.idPrefix, width = this.idWidth): string {
    const max = Math.max(0, ...this.items().map(x => Number(String(x.id).split('-').pop()) || 0));
    return `${prefix}-${String(max + 1).padStart(width, '0')}`;
  }

  /** Adds a record; the id is generated unless the record already carries one. */
  add(rec: Omit<T, 'id'> & { id?: string }, atStart = true): T {
    const full = { ...rec, id: rec.id ?? this.nextId() } as T;
    this.commit(atStart ? [full, ...this.items()] : [...this.items(), full]);
    return full;
  }

  update(id: string, patch: Partial<T>): void {
    this.commit(this.items().map(x => (x.id === id ? { ...x, ...patch } : x)));
  }

  remove(id: string): T | undefined {
    const gone = this.get(id);
    this.commit(this.items().filter(x => x.id !== id));
    return gone;
  }

  /** Replace everything (bulk import, reset). */
  replace(list: T[]): void {
    this.commit(list);
  }

  reset(): void {
    this.commit(this.seed());
  }
}
