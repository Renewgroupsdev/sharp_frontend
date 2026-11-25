import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ROLES } from '../../core/data/models';
import { ApiOk } from '../models/api.model';
import { USER_STATUSES } from '../models/user.model';

/** Lookup lists served by sharp-api `GET /enums`. */
export type EnumName = 'roles' | 'user-statuses' | 'college-statuses' | 'attendance-statuses' | 'moderation-actions';

export interface EnumOption { value: string; label: string }

/**
 * Single source for backend lookup lists (roles, statuses, ...), so nothing re-declares them.
 *
 * When it loads: once at app start when a token is already stored (provideAppInitializer in app.config), and again
 * right after a successful sign-in (AuthService.signIn). The endpoint needs a signed-in user, so it can't run earlier.
 */
@Injectable({ providedIn: 'root' })
export class EnumsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  private loading: Promise<void> | null = null;

  readonly enums = signal<Partial<Record<EnumName, EnumOption[]>>>({});
  readonly loaded = computed(() => !!this.enums().roles);

  /**
   * Backend role slug <-> portal role name. The portal name is the API label matched case-insensitively against the
   * portal's known roles (API "Ob" -> "OB"); a role the portal has no screens for (Trainer) keeps the API label.
   */
  private readonly roleNames = computed(() => {
    const pairs = (this.enums().roles ?? []).map(o => [o.value, ROLES.find(r => r.toLowerCase() === o.label.toLowerCase()) ?? o.label] as const);
    return { bySlug: new Map(pairs), bySlugRev: new Map(pairs.map(([slug, name]) => [name, slug])) };
  });

  /** Portal role names the portal has screens for, in API order. */
  readonly roles = computed<string[]>(() => {
    const names = [...this.roleNames().bySlug.values()].filter(n => (ROLES as readonly string[]).includes(n));
    return names.length ? names : [...ROLES];
  });

  /** Every role the API lists (Trainer included), as portal names - for pickers that must offer exactly what the backend accepts. */
  readonly allRoles = computed<string[]>(() => (this.enums().roles ? [...this.roleNames().bySlug.values()] : [...ROLES]));

  readonly userStatuses = computed<string[]>(() => this.enums()['user-statuses']?.map(o => o.value) ?? [...USER_STATUSES]);

  /** Portal role name for a backend slug, or null while the enums are not loaded / the slug is unknown. */
  readonly roleLabel = (slug: string): string | null => this.roleNames().bySlug.get(slug) ?? null;

  /** Backend slug for a portal role name, for request bodies. */
  readonly roleSlug = (name: string): string => this.roleNames().bySlugRev.get(name) ?? name.toLowerCase().replace(/\s+/g, '_');

  /** GET /enums, once. Never rejects: a failure leaves the fallbacks in place and the next call retries. */
  load(): Promise<void> {
    return (this.loading ??= firstValueFrom(this.http.get<ApiOk<{ enums: Record<EnumName, EnumOption[]> }>>(`${this.base}/enums`))
      .then(res => this.enums.set(res.enums))
      .catch(() => { this.loading = null; }));
  }

  /** GET /enums/{name} for a single list; also stores it. */
  async fetch(name: EnumName): Promise<EnumOption[]> {
    const { options } = await firstValueFrom(this.http.get<ApiOk<{ options: EnumOption[] }>>(`${this.base}/enums/${name}`));
    this.enums.update(cur => ({ ...cur, [name]: options }));
    return options;
  }

  options(name: EnumName): EnumOption[] {
    return this.enums()[name] ?? [];
  }

  /** The API's label for a value, or the value itself when unknown. */
  label(name: EnumName, value: string): string {
    return this.options(name).find(o => o.value === value)?.label ?? value;
  }

  /** Forget everything on sign-out, so the next account reloads fresh lists. */
  reset(): void {
    this.enums.set({});
    this.loading = null;
  }
}
