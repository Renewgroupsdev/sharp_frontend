import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BatchApiResource {
  id: number | string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  seats?: number | null;
  mentors?: number | null;
  status?: string | null;
  student_count?: number | null;
  colleges?: { id: number | string; name: string }[];
  courses?: { id: number; code: string; title: string }[];
}

export interface BatchPayload {
  name: string;
  start_date: string;
  end_date: string;
  seats: number;
  mentors: number;
  status: string;
  college_ids: number[];
  course_ids: number[];
}

export interface BatchListResponse {
  ok: boolean;
  batches: BatchApiResource[];
}

export interface BatchResponse {
  ok: boolean;
  batch: BatchApiResource;
}

@Injectable({ providedIn: 'root' })
export class BatchesApi {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiBaseUrl}/batches`;

  getBatches(): Promise<BatchListResponse> {
    return firstValueFrom(this.http.get<BatchListResponse>(this.baseUrl));
  }

  createBatch(payload: BatchPayload): Promise<BatchResponse> {
    return firstValueFrom(this.http.post<BatchResponse>(this.baseUrl, payload));
  }

  updateBatch(id: number | string, payload: BatchPayload): Promise<BatchResponse> {
    return firstValueFrom(
      this.http.put<BatchResponse>(`${this.baseUrl}/${encodeURIComponent(String(id))}`, payload)
    );
  }

  deleteBatch(id: number | string): Promise<{ ok: boolean; message?: string }> {
    return firstValueFrom(
      this.http.delete<{ ok: boolean; message?: string }>(`${this.baseUrl}/${encodeURIComponent(String(id))}`)
    );
  }
}
