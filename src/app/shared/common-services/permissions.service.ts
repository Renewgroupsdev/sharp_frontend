import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { buildPermissions } from '../../core/data/seed';
import { PermissionMap } from '../../core/data/models';

const KEY = environment.storagePrefix + 'perms';

/** Roles & Permissions matrix: which of view / create / edit / delete (v, c, u, d) each role holds per module. */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
  readonly matrix = signal<PermissionMap>(this.load());
  /** Defaults, used for a module added after the saved matrix was stored, so it never reads as "no access". */
  private readonly defaults = buildPermissions();

  private load(): PermissionMap {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as PermissionMap; } catch { /* use defaults */ }
    return buildPermissions();
  }

  private save(m: PermissionMap): void {
    this.matrix.set(m);
    try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* storage blocked */ }
  }

  /** The letters (e.g. "vcu") a role holds on a module. */
  letters(role: string, moduleKey: string): string {
    return this.matrix()[role]?.[moduleKey] ?? this.defaults[role]?.[moduleKey] ?? '';
  }

  has(role: string, moduleKey: string, letter: 'v' | 'c' | 'u' | 'd'): boolean {
    return this.letters(role, moduleKey).includes(letter);
  }

  toggle(role: string, moduleKey: string, letter: string): void {
    const cur = this.letters(role, moduleKey);
    const next = cur.includes(letter) ? cur.replace(letter, '') : cur + letter;
    const ordered = ['v', 'c', 'u', 'd'].filter(l => next.includes(l)).join('');
    this.save({ ...this.matrix(), [role]: { ...this.matrix()[role], [moduleKey]: ordered } });
  }

  resetDefaults(): void {
    this.save(buildPermissions());
  }
}
