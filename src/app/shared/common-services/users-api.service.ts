import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiOk, ApiUserResource, CreateUserBody, UpdateUserBody, UserListFilters } from '../models/api.model';

/** Typed calls to sharp-api `/api/web` users + me. Public ids contain slashes, so they go into the path as-is. */
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  private userUrl(id: string, action = ''): string {
    return `${this.base}/users/${encodeURI(id)}${action}`;
  }

  me() {
    return firstValueFrom(this.http.get<ApiOk<{ user: ApiUserResource }>>(`${this.base}/me`));
  }

  list(filters: UserListFilters = {}) {
    const params = new HttpParams({ fromObject: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string | number> });
    return firstValueFrom(this.http.get<ApiOk<{ users: ApiUserResource[]; count: number }>>(`${this.base}/users`, { params }));
  }

  /** The Specialist pick-list (new names typed under "Other" join it when a user is saved). */
  specialists() {
    return firstValueFrom(this.http.get<ApiOk<{ specialists: string[] }>>(`${this.base}/specialists`));
  }

  /** Students also come back with `attendance: { rate, records }`. */
  show(id: string) {
    return firstValueFrom(this.http.get<ApiOk<{ user: ApiUserResource; attendance?: { rate: number; records: unknown[] } }>>(this.userUrl(id)));
  }

  /** `temp_password` is returned once, here only. */
  create(body: CreateUserBody) {
    return firstValueFrom(this.http.post<ApiOk<{ user: ApiUserResource; temp_password: string }>>(`${this.base}/users`, body));
  }

  update(id: string, body: UpdateUserBody) {
    return firstValueFrom(this.http.put<ApiOk<{ user: ApiUserResource }>>(this.userUrl(id), body));
  }

  /** Refused (422) for your own account and for accounts with attendance records. */
  remove(id: string) {
    return firstValueFrom(this.http.delete<ApiOk<{ message: string }>>(this.userUrl(id)));
  }

  suspend(id: string) {
    return firstValueFrom(this.http.post<ApiOk<{ message: string }>>(this.userUrl(id, '/suspend'), {}));
  }

  activate(id: string) {
    return firstValueFrom(this.http.post<ApiOk<{ message: string }>>(this.userUrl(id, '/activate'), {}));
  }

  resetPassword(id: string) {
    return firstValueFrom(this.http.post<ApiOk<{ message: string; temp_password: string }>>(this.userUrl(id, '/reset-password'), {}));
  }
}
