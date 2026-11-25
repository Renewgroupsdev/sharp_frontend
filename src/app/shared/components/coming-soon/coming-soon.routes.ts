import { Route } from '@angular/router';
import { ComingSoonInfo, comingSoonData } from './coming-soon.model';

/**
 * Route fragment for a not-yet-built module: `{ path: 'users', canActivate: [...], ...comingSoon(COMING_SOON.users) }`.
 * The component is lazy-loaded once and shared by every placeholder route.
 */
export const comingSoon = (info: ComingSoonInfo): Pick<Route, 'loadComponent' | 'data'> => ({
  loadComponent: () => import('./coming-soon').then(m => m.ComingSoon),
  data: comingSoonData(info),
});
