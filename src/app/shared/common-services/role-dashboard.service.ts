import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RoleDashboardData } from '../models/role-dashboard.model';

/** The signed-in person's own dashboard (GET my/dashboard). The API decides what each role sees and scopes every number. */
@Injectable({ providedIn: 'root' })
export class RoleDashboardService {
  private readonly http = inject(HttpClient);

  async load(): Promise<RoleDashboardData> {
    return (await firstValueFrom(this.http.get<{ dashboard: RoleDashboardData }>(`${environment.apiBaseUrl}/my/dashboard`))).dashboard;
  }
}
