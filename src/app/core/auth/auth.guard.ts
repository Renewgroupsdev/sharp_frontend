import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Route, Router } from '@angular/router';
import { ADMIN_MODULES } from '../data/models';
import { AuthService, Shell } from './auth.service';

/** Everything under /app needs a chosen role. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (auth.isAuthenticated() && (await auth.refreshProfile())) || router.createUrlTree(['/login']);
};

/** Skip the login page when a role is already chosen. */
export const loginRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).parseUrl(auth.homeUrl()) : true;
};

/** Matches only for the given app(s), so one URL can resolve to a different page per role. */
export const roleMatch = (...shells: Shell[]): CanMatchFn => () => shells.includes(inject(AuthService).shell());

/**
 * Permission guard on an action slug `<moduleKey>.<view|create|edit|delete>` (e.g. `a_users.create`).
 * Denied -> the role's home page.
 */
export const actionGuard = (slug: string): CanActivateFn => () => {
  const auth = inject(AuthService);
  return auth.hasActionAccess(slug) ? true : inject(Router).parseUrl(auth.homeUrl());
};

/** Route guard for an admin module: the role needs View permission on it. */
export const moduleGuard = (moduleKey: string): CanActivateFn =>
  ADMIN_MODULES.some(m => m.key === moduleKey) ? actionGuard(`${moduleKey}.view`) : () => true;

/** Scopes routes to an app: each route only matches for that role. */
export const forShell = (shell: Shell, routes: Route[]): Route[] =>
  routes.map(r => ({ ...r, canMatch: [roleMatch(shell), ...(r.canMatch ?? [])] }));

/** An admin-module route: needs View on the module. Pass `actions` to add guarded create / edit / delete routes. */
export const moduleRoute = (moduleKey: string, route: Route, actions: Partial<Record<'create' | 'edit' | 'delete', Route>> = {}): Route[] => [
  { ...route, canActivate: [moduleGuard(moduleKey), ...(route.canActivate ?? [])] },
  ...Object.entries(actions).map(([action, r]) => ({ ...r, canActivate: [actionGuard(`${moduleKey}.${action}`), ...(r.canActivate ?? [])] })),
];
