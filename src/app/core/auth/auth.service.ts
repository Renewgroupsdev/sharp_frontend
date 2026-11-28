import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PermissionsService } from '../../shared/common-services/permissions.service';
import { EnumsService } from '../../shared/common-services/enums.service';
import { UsersApi } from '../../shared/common-services/users-api.service';
import { UsersService } from '../../shared/common-services/users.service';
import { ROLES, Role, SharpUser } from '../data/models';

const TOKEN_KEY = environment.storagePrefix + 'token';
const USER_KEY = environment.storagePrefix + 'user';

/** The signed-in account as returned by POST /auth/login.php. */
export interface ApiUser {
  id: string;
  name: string;
  username: string;
  role: string;
  initials: string;
  color: string;
  must_change_password?: boolean;
}

export type Shell = 'admin' | 'mentor' | 'student';

/** The signed-in account (token from the SHARP backend API), its role, and what that role may do on each admin module. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly perms = inject(PermissionsService);
  private readonly users = inject(UsersService);
  private readonly router = inject(Router);
  private readonly usersApi = inject(UsersApi);
  private readonly enums = inject(EnumsService);
  private profileChecked = false;

  private readonly session = signal<ApiUser | null>(this.readSession());
  readonly role = computed<Role | null>(() => {
    const name = this.enums.roleLabel(this.session()?.role ?? '');
    return (ROLES as readonly string[]).includes(name ?? '') ? (name as Role) : null;
  });
  readonly isAuthenticated = computed(() => this.role() !== null && !!this.token());
  /** True until the account has set its own password (first sign-in, or after an administrator's reset). */
  readonly mustChangePassword = computed(() => !!this.session()?.must_change_password);
  readonly displayName = computed(() => this.session()?.name ?? '');

  /** The signed-in person's id straight from the session (the API's public id); unlike `actor()` it never waits for the user list. */
  readonly userId = computed(() => this.session()?.id ?? '');

  /** Which app the role lands in: the admin workspace, the mentor screens or the student screens. */
  readonly shell = computed<Shell>(() => (this.role() === 'Mentor' ? 'mentor' : this.role() === 'Student' ? 'student' : 'admin'));

  /**
   * The portal account behind the signed-in user: the seeded record with the same username / id (or, failing that,
   * the first one for the role), carrying the real name / initials / colour from the API.
   */
  readonly actor = computed<SharpUser>(() => {
    const me = this.session();
    const r = this.role() ?? 'Super Admin';
    const all = this.users.items();
    const base = all.find(u => u.username === me?.username || u.id === me?.id) ?? all.find(u => u.r === r) ?? all[0];
    return me ? { ...base, n: me.name, i: me.initials, col: me.color } : base;
  });

  private readSession(): ApiUser | null {
    try {
      if (!localStorage.getItem(TOKEN_KEY)) return null;
      return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as ApiUser | null;
    } catch { return null; }
  }

  private readonly token = signal<string | null>(this.readToken());

  private readToken(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }

  private async api(path: string, body?: unknown, bearer?: string): Promise<{ ok: boolean; error?: string; token?: string; user?: ApiUser }> {
    try {
      const res = await fetch(environment.apiBaseUrl + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await res.json();
    } catch {
      return { ok: false, error: 'Could not reach the server. Please try again.' };
    }
  }

  /** Username / password sign-in against backend/api/auth/login.php, for every role. Resolves to an error message, or null on success. */
  async signIn(username: string, password: string): Promise<string | null> {
    const u = username.trim();
    if (!u || !password) return 'Enter your username and password.';
    const res = await this.api('/auth/login', { username: u, password });
    if (!res.ok || !res.token || !res.user) return res.error ?? 'Sign-in failed.';
    try {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    } catch { /* storage blocked */ }
    this.token.set(res.token);
    // GET /enums needs the token, and the role name comes from it - so load it before the session counts as signed in.
    await this.enums.load();
    await this.perms.load(true);
    this.session.set(res.user);
    if (!this.enums.loaded()) return this.discardSession('Could not load the portal settings. Please try again.');
    if (!this.role()) return this.discardSession('This portal does not support Trainer accounts. Please sign in from the SHARP mobile app instead.');
    return null;
  }

  /** Takes a saved profile into the session (name and initials show in the top bar) and refreshes the user list (for the picture). */
  applyProfile(user: { name: string; initials: string }): void {
    const cur = this.session();
    if (!cur) return;
    const next: ApiUser = { ...cur, name: user.name, initials: user.initials };
    this.session.set(next);
    try { localStorage.setItem(USER_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
    void this.users.refresh();
  }

  /** A tab of a page, from the Roles & Permissions tree (e.g. `a_certs.tab.templates`). */
  hasTab(slug: string): boolean { return this.perms.hasTab(slug); }

  accessToken(): string | null {
    return this.token();
  }

  /** Once per page load: re-reads the account from GET /me, so a stale or revoked token signs out instead of failing later. */
  async refreshProfile(): Promise<boolean> {
    if (this.profileChecked) return this.isAuthenticated();
    try {
      const { user } = await this.usersApi.me();
      this.profileChecked = true;
      const cur = this.session();
      if (cur) {
        const next: ApiUser = { ...cur, name: user.name, username: user.username ?? cur.username, role: user.role, initials: user.initials, color: user.color, must_change_password: user.must_change_password };
        this.session.set(next);
        try { localStorage.setItem(USER_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
      }
    } catch { /* a 401 already signed out in the interceptor; offline keeps the stored session */ }
    return this.isAuthenticated();
  }

  logout(to = '/login'): void {
    this.clearSession();
    void this.router.navigateByUrl(to);
  }

  /** Revokes the token and forgets the session without navigating; returns `message` for the login form. */
  private discardSession(message: string): string {
    this.clearSession();
    return message;
  }

  private clearSession(): void {
    const t = this.token();
    if (t) void this.api('/auth/logout', undefined, t);
    this.session.set(null);
    this.token.set(null);
    this.enums.reset();
    this.perms.clear();
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch { /* storage blocked */ }
  }

  homeUrl(): string {
    return this.mustChangePassword() ? '/change-password' : '/app/dashboard';
  }

  /** Permission letter check for the current role on an admin module, e.g. can('a_orgs', 'c'). */
  can(moduleKey: string, letter: 'v' | 'c' | 'u' | 'd'): boolean {
    const r = this.role();
    return !!r && this.perms.can(moduleKey, letter);
  }

  /**
   * Action slug check used by the shared table card: `<moduleKey>.<view|create|edit|delete>`,
   * e.g. `a_orgs.edit`. Slugs without a dot are always allowed.
   */
  hasActionAccess(slug: string): boolean {
    const [mod, act] = slug.split('.');
    const letter = ({ view: 'v', create: 'c', edit: 'u', delete: 'd' } as const)[act as 'view'];
    return !act || !letter ? true : this.can(mod, letter);
  }

  /** Roles & Permissions action label / icon overrides - none in the prototype. */
  actionDetails(_slug: string): { action_name?: string; logo?: string } | null {
    return null;
  }
}
