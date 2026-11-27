import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** One node of the Roles & Permissions tree: a module or sub-module with its tabs and actions, and the roles allowed on each. */
export interface PermAction { slug: string; name: string; roles: string[] }
export interface PermTab { slug: string; name: string; icon?: string | null; roles: string[] }
export interface PermNode {
  slug: string;
  name: string;
  icon?: string | null;
  roles: string[];
  actions: PermAction[];
  tabs: PermTab[];
  sub_modules: PermNode[];
}

/** The role values the API uses, with the names shown on screen. */
export const ASSIGNABLE_ROLES: { value: string; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' }, { value: 'admin', label: 'Admin' }, { value: 'mentor', label: 'Mentor' },
  { value: 'member', label: 'Member' }, { value: 'ob', label: 'OB' }, { value: 'institution', label: 'Institution' }, { value: 'student', label: 'Student' },
];

/**
 * What the signed-in role may use, from GET /permissions/mine: module slugs (sub-modules included), action slugs such as
 * `a_users.create`, and tab slugs such as `a_certs.tab.templates`. Access to a module is its View; Create, Edit and Delete
 * are its actions. The Roles & Permissions screen reads and writes the whole tree.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/permissions`;

  readonly modules = signal<ReadonlySet<string>>(new Set());
  readonly actions = signal<ReadonlySet<string>>(new Set());
  readonly tabs = signal<ReadonlySet<string>>(new Set());
  readonly loaded = signal(false);
  private loading?: Promise<void>;

  /** Loads the signed-in role's permissions once (pass `force` after they change). */
  load(force = false): Promise<void> {
    if (this.loaded() && !force) return Promise.resolve();
    this.loading ??= (async () => {
      try {
        const res = await firstValueFrom(this.http.get<{ modules: string[]; actions: string[]; tabs: string[] }>(`${this.base}/mine`));
        this.modules.set(new Set(res.modules));
        this.actions.set(new Set(res.actions));
        this.tabs.set(new Set(res.tabs));
        this.loaded.set(true);
      } catch {
        // Leave everything closed rather than guessing: a screen without its permissions shows nothing.
      } finally {
        this.loading = undefined;
      }
    })();
    return this.loading;
  }

  clear(): void {
    this.modules.set(new Set());
    this.actions.set(new Set());
    this.tabs.set(new Set());
    this.loaded.set(false);
  }

  /** View / Create / Edit / Delete on a module (v, c, u, d). */
  can(moduleKey: string, letter: 'v' | 'c' | 'u' | 'd'): boolean {
    if (letter === 'v') return this.modules().has(moduleKey);
    const action = ({ c: 'create', u: 'edit', d: 'delete' } as const)[letter];
    return this.actions().has(`${moduleKey}.${action}`);
  }

  hasTab(slug: string): boolean { return this.tabs().has(slug); }

  /* ---------- the Assign Permissions screen ---------- */

  async tree(): Promise<PermNode[]> {
    return (await firstValueFrom(this.http.get<{ modules: PermNode[] }>(`${this.base}/tree`))).modules;
  }

  async save(nodes: PermNode[]): Promise<void> {
    const modules: Record<string, string[]> = {};
    const actions: Record<string, string[]> = {};
    const tabs: Record<string, string[]> = {};
    const walk = (list: PermNode[]) => {
      for (const n of list) {
        modules[n.slug] = n.roles;
        n.actions.forEach(a => (actions[a.slug] = a.roles));
        n.tabs.forEach(t => (tabs[t.slug] = t.roles));
        walk(n.sub_modules);
      }
    };
    walk(nodes);
    await firstValueFrom(this.http.put(`${this.base}/tree`, { modules, actions, tabs }));
    await this.load(true);
  }

  async reset(): Promise<PermNode[]> {
    const res = await firstValueFrom(this.http.post<{ modules: PermNode[] }>(`${this.base}/reset`, {}));
    await this.load(true);
    return res.modules;
  }
}
