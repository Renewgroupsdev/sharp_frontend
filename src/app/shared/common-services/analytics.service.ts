import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Analytics } from '../models/analytics.model';

/** Typed client for the Super Admin analytics dashboard (staff only; the API refuses everyone else). */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);

  async load(months: number): Promise<Analytics> {
    return (await firstValueFrom(this.http.get<{ analytics: Analytics }>(`${environment.apiBaseUrl}/dashboard/analytics`, { params: { months } }))).analytics;
  }
}
