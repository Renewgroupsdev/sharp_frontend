import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GalleryItem {
  id: number;
  title: string;
  description: string | null;
  event: string | null;
  event_date: string | null;
  type: 'image' | 'video';
  file_name: string;
  mime: string;
  size: number;
  /** A signed link that <img> and <video> open directly. */
  url: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface GalleryInput { title: string; description: string; event: string; event_date: string }

/** Typed calls to /api/web/gallery. */
@Injectable({ providedIn: 'root' })
export class GalleryApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/gallery`;

  async list(): Promise<GalleryItem[]> {
    return (await firstValueFrom(this.http.get<{ items: GalleryItem[] }>(this.base))).items;
  }

  async add(input: GalleryInput, files: File[]): Promise<GalleryItem[]> {
    const form = new FormData();
    form.append('title', input.title);
    if (input.description) form.append('description', input.description);
    if (input.event) form.append('event', input.event);
    if (input.event_date) form.append('event_date', input.event_date);
    files.forEach(f => form.append('files[]', f));
    return (await firstValueFrom(this.http.post<{ items: GalleryItem[] }>(this.base, form))).items;
  }

  async update(id: number, input: GalleryInput): Promise<GalleryItem> {
    const body = { title: input.title, description: input.description || null, event: input.event || null, event_date: input.event_date || null };
    return (await firstValueFrom(this.http.put<{ item: GalleryItem }>(`${this.base}/${id}`, body))).item;
  }

  remove(id: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}
