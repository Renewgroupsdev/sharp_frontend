import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { apiInterceptor } from './core/http/api.interceptor';
import { EnumsService } from './shared/common-services/enums.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([apiInterceptor])),
    // A stored token means a returning visitor: load the backend lookups (roles, statuses, ...) before the first
    // route, because the signed-in role's name comes from them. First-time visitors load them in AuthService.signIn.
    provideAppInitializer(() => (inject(AuthService).accessToken() ? inject(EnumsService).load() : undefined)),
  ],
};
