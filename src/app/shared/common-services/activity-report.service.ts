import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActivityReport } from '../models/activity-report.model';

/** Typed client for the dashboard's activity charts (staff only; the API refuses everyone else). */
@Injectable({ providedIn: 'root' })
export class ActivityReportService {
  private readonly http = inject(HttpClient);

  async load(days: number): Promise<ActivityReport> {
    return (await firstValueFrom(this.http.get<{ activity: ActivityReport }>(`${environment.apiBaseUrl}/dashboard/activity`, { params: { days } }))).activity;
  }
}
