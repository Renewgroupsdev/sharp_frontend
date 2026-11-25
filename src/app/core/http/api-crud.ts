import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Every sharp-api response is `{ ok: true, ...data }`; errors are `{ ok: false, error }` (see apiErrorMessage). */
type Envelope = { ok: boolean; message?: string } & Record<string, unknown>;

/**
 * Generic REST client for one sharp-api resource. `one` / `many` are the envelope keys the API wraps
 * the record(s) in (e.g. `course` / `courses`). Extend it to add resource-specific endpoints via `call()`.
 */
export class ApiCrud<TRes, TPayload> {
  protected readonly baseUrl: string;

  constructor(
    protected readonly http: HttpClient,
    path: string,
    private readonly one: string,
    private readonly many: string,
  ) {
    this.baseUrl = `${environment.apiBaseUrl}/${path}`;
  }

  async list(params: Record<string, string | number | boolean | undefined> = {}): Promise<TRes[]> {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string | number | boolean>;
    const res = await firstValueFrom(this.http.get<Envelope>(this.baseUrl, { params: clean }));
    return this.pick<TRes[]>(res, this.many);
  }

  async get(id: number | string): Promise<TRes> {
    return this.pick<TRes>(await this.call('get', this.url(id)), this.one);
  }

  async create(payload: TPayload): Promise<TRes> {
    return this.pick<TRes>(await this.call('post', this.baseUrl, payload), this.one);
  }

  async update(id: number | string, payload: TPayload): Promise<TRes> {
    return this.pick<TRes>(await this.call('put', this.url(id), payload), this.one);
  }

  /** Resolves with the server's confirmation message, when it sends one. */
  async remove(id: number | string, suffix = ''): Promise<string | undefined> {
    return (await this.call('delete', this.url(id) + suffix)).message;
  }

  protected url(id: number | string, suffix = ''): string {
    return `${this.baseUrl}/${encodeURIComponent(String(id))}${suffix}`;
  }

  protected async call(method: 'get' | 'post' | 'put' | 'delete', url: string, body?: unknown): Promise<Envelope> {
    const request =
      method === 'get' ? this.http.get<Envelope>(url)
      : method === 'delete' ? this.http.delete<Envelope>(url)
      : method === 'post' ? this.http.post<Envelope>(url, body ?? {})
      : this.http.put<Envelope>(url, body ?? {});
    const res = await firstValueFrom(request);
    if (res?.ok !== true) throw new Error(res?.message || 'Unexpected response from the server.');
    return res;
  }

  protected pick<T>(res: Envelope, key: string): T {
    if (res?.ok !== true || res[key] === undefined) throw new Error('Unexpected response from the server.');
    return res[key] as T;
  }
}
