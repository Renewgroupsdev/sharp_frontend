import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InstituteApiResource {
  id: number | string;
  name: string;
  code?: string | null;
  city?: string | null;
  principal_name?: string | null;
  email?: string | null;
  mobile?: string | null;
  status?: string | null;
  lat?: number | null;
  lng?: number | null;
  geofence_radius_m?: number;
}

export interface InstitutePayload {
  name: string;
  city?: string;
  principal_name?: string;
  email?: string;
  mobile?: string; 
  status?: string;
  lat?: number | null;
  lng?: number | null;
  geofence_radius_m?: number;
}

export interface InstituteListResponse {
  ok: boolean;
  colleges: InstituteApiResource[];
  count?: number;
}

interface CollegeResponse {
  ok: boolean;
  college?: InstituteApiResource;
  institute?: InstituteApiResource;
  message?: string;
}

export interface InstituteResponse {
  ok: boolean;
  institute: InstituteApiResource;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class InstitutesApi {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiBaseUrl}/colleges`;

  getInstitutes(): Promise<InstituteListResponse> {
    return firstValueFrom(
      this.http.get<InstituteListResponse>(this.baseUrl)
    );
  }

  async createInstitute(payload: InstitutePayload): Promise<InstituteResponse> {
    const response = await firstValueFrom(this.http.post<CollegeResponse>(this.baseUrl, payload));
    if (response.ok !== true || !response.college) throw new Error(response.message || 'Unable to create institute.');
    return { ok: true, institute: response.college, message: response.message };
  }

  async getInstitute(id: number | string): Promise<InstituteResponse> {
    const response = await firstValueFrom(
      this.http.get<CollegeResponse>(
        `${this.baseUrl}/${encodeURIComponent(String(id))}`
      )
    );
    const institute = response.college ?? response.institute;
    if (response.ok !== true || !institute) throw new Error('Unable to load institute details.');
    return { ok: true, institute };
  }

  async updateInstitute(id: number | string, payload: InstitutePayload): Promise<InstituteResponse> {
    const response = await firstValueFrom(
      this.http.put<CollegeResponse>(`${this.baseUrl}/${encodeURIComponent(String(id))}`, payload)
    );
    const institute = response.college ?? response.institute;
    if (response.ok !== true || !institute) throw new Error(response.message || 'Unable to update institute.');
    return { ok: true, institute, message: response.message };
  }

  deleteInstitute(
    id: number | string
  ): Promise<{ ok: boolean; message?: string }> {
    return firstValueFrom(
      this.http.delete<{ ok: boolean; message?: string }>(
        `${this.baseUrl}/${encodeURIComponent(String(id))}`
      )
    );
  }
}
