import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/** Adds the bearer token to sharp-api calls; a 401 on one of them means the session is gone, so sign out. */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) return next(req);
  const auth = inject(AuthService);
  const token = auth.accessToken();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }) : req;
  return next(authed).pipe(
    catchError((e: unknown) => {
      if (e instanceof HttpErrorResponse && e.status === 401 && token) auth.logout();
      return throwError(() => e);
    }),
  );
};

/** The API's error message (`{ ok: false, error }`), or a fallback when the server could not be reached. */
export function apiErrorMessage(e: unknown): string {
  if (e instanceof HttpErrorResponse) return e.error?.error ?? (e.status === 0 ? 'Could not reach the server. Please try again.' : 'Something went wrong.');
  return e instanceof Error ? e.message : 'Something went wrong.';
}
