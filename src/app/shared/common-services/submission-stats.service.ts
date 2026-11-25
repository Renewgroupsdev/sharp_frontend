import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SubmissionStats } from '../models/submission-stats.model';

@Injectable({ providedIn: 'root' })
export class SubmissionStatsService {
  private readonly http = inject(HttpClient);

  async load(): Promise<SubmissionStats> {
    return (await firstValueFrom(this.http.get<{ ok: boolean; stats: SubmissionStats }>(`${environment.apiBaseUrl}/submission-stats`))).stats;
  }
}
