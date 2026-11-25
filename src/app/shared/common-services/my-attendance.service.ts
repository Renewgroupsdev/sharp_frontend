import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiUserResource } from '../models/api.model';

export interface MyAttendanceRecord {
  id: number;
  att_date: string;
  status: string;
  reason: string | null;
  marked_by_name: string | null;
}

/** The signed-in student's own attendance (GET /api/web/attendance): rate, records and their profile (batch, institute). */
@Injectable({ providedIn: 'root' })
export class MyAttendanceService {
  private readonly http = inject(HttpClient);

  readonly student = signal<ApiUserResource | null>(null);
  readonly rate = signal(0);
  readonly records = signal<MyAttendanceRecord[]>([]);

  async load(): Promise<void> {
    const res = await firstValueFrom(this.http.get<{ ok: boolean; student: ApiUserResource; rate: number; records: MyAttendanceRecord[] }>(`${environment.apiBaseUrl}/attendance`));
    if (res?.ok !== true) throw new Error('Unexpected response from the server.');
    this.student.set(res.student);
    this.rate.set(res.rate);
    this.records.set(res.records);
  }
}
