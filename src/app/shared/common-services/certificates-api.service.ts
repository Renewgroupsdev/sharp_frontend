import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCrud } from '../../core/http/api-crud';
import { CertDesign, CertQrCode, CertScan, CertSettings, CertTemplate, CertVerification, Certificate } from '../models/certificate.model';

export type CertificateApiResource = Certificate;

/** Thrown by `issue` when the student is below the minimum attendance or score and the call was not an override. */
export class EligibilityError extends Error {}

/** The wording and signature staff may change on one certificate. */
export interface CertificateDesignEdit {
  template: string;
  type: string;
  title: string;
  body: string;
  signature_name: string | null;
  signature_role: string | null;
  signature_image: string | null;
  accent?: string | null;
  show_profile: boolean;
  show_qr: boolean;
  show_logo?: boolean;
  logo_position?: string;
  logo_image?: string | null;
  logos?: { image: string; position: string }[];
}

export interface CertificateEdit { issue_date?: string | null; score?: number | null; min_attendance?: number | null; design?: CertificateDesignEdit | null }

export interface CertificateFilters { course_id?: number; batch_id?: number; status?: string; q?: string }

/** /api/web/certificates, /my/certificates, /certificate-settings and the public /verify/{number}. */
@Injectable({ providedIn: 'root' })
export class CertificatesApi extends ApiCrud<Certificate, never> {
  private readonly rawHttp = inject(HttpClient);

  constructor() { super(inject(HttpClient), 'certificates', 'certificate', 'certificates'); }

  /** Staff create a Pending certificate; `studentId` is the student's public id (SH2026-0412). */
  async createFor(studentId: string, courseId: number, templateId?: number | null): Promise<Certificate> {
    return this.pick<Certificate>(await this.call('post', this.baseUrl, { student_id: studentId, course_id: courseId, ...(templateId ? { template_id: templateId } : {}) }), 'certificate');
  }

  /** The saved certificate templates. */
  async templates(): Promise<CertTemplate[]> {
    return (await firstValueFrom(this.rawHttp.get<{ ok: boolean; templates: CertTemplate[] }>(`${environment.apiBaseUrl}/certificate-templates`))).templates;
  }

  async saveTemplate(body: { name: string; description: string | null; design: CertDesign }, id?: number): Promise<CertTemplate> {
    const url = `${environment.apiBaseUrl}/certificate-templates`;
    const res = await firstValueFrom(id ? this.rawHttp.put<{ ok: boolean; template: CertTemplate }>(`${url}/${id}`, body) : this.rawHttp.post<{ ok: boolean; template: CertTemplate }>(url, body));
    return res.template;
  }

  async deleteTemplate(id: number): Promise<void> {
    await firstValueFrom(this.rawHttp.delete(`${environment.apiBaseUrl}/certificate-templates/${id}`));
  }

  /** Staff edit a certificate that is not issued yet; an issued one is locked. A field left out is unchanged, null clears it. */
  async edit(id: number | string, body: CertificateEdit): Promise<Certificate> {
    return this.pick<Certificate>(await this.call('put', this.url(id), body), 'certificate');
  }

  /** Assigns the number and tells the student. Below the minimums it throws EligibilityError unless `override` is set. */
  async issue(id: number | string, override = false): Promise<Certificate> {
    try {
      return this.pick<Certificate>(await this.call('post', this.url(id, '/issue'), override ? { override: true } : {}), 'certificate');
    } catch (e) {
      const message = e instanceof HttpErrorResponse && e.status === 422 ? (e.error?.errors?.eligibility?.[0] as string | undefined) : undefined;
      throw message ? new EligibilityError(message) : e;
    }
  }

  async reject(id: number | string): Promise<Certificate> {
    return this.pick<Certificate>(await this.call('post', this.url(id, '/reject')), 'certificate');
  }

  /** Cancels an issued certificate. `reason` is one of cancelReasons(); `note` is required when it is "Other". */
  async cancel(id: number | string, reason: string, note?: string): Promise<Certificate> {
    return this.pick<Certificate>(await this.call('post', this.url(id, '/cancel'), { reason, note: note ?? null }), 'certificate');
  }

  /** The reasons staff can pick from, as the API defines them. */
  async cancelReasons(): Promise<string[]> {
    return (await firstValueFrom(this.rawHttp.get<{ ok: boolean; reasons: string[] }>(`${environment.apiBaseUrl}/certificate-cancel-reasons`))).reasons;
  }

  /** The mentor's recommendation; it does not issue anything. */
  async review(id: number | string, decision: 'approved' | 'returned', note?: string): Promise<Certificate> {
    return this.pick<Certificate>(await this.call('post', this.url(id, '/review'), { decision, note: note ?? null }), 'certificate');
  }

  async mine(): Promise<Certificate[]> {
    const res = await firstValueFrom(this.rawHttp.get<{ ok: boolean; certificates: Certificate[] }>(`${environment.apiBaseUrl}/my/certificates`));
    return res.certificates;
  }

  async getSettings(): Promise<CertSettings> {
    return (await firstValueFrom(this.rawHttp.get<{ ok: boolean; settings: CertSettings }>(`${environment.apiBaseUrl}/certificate-settings`))).settings;
  }

  /** `signature_image` left out keeps the current signature; `remove_signature_image` clears it. */
  async saveSettings(body: CertSettings & { remove_signature_image?: boolean }): Promise<CertSettings> {
    return (await firstValueFrom(this.rawHttp.put<{ ok: boolean; settings: CertSettings }>(`${environment.apiBaseUrl}/certificate-settings`, body))).settings;
  }

  /** The signed-in student's course QR codes (one per enrolled course). */
  async myQrCodes(): Promise<CertQrCode[]> {
    return (await firstValueFrom(this.rawHttp.get<{ ok: boolean; codes: CertQrCode[] }>(`${environment.apiBaseUrl}/my/certificate-qr`))).codes;
  }

  /** Staff: a student's course QR codes; `studentId` is the public id. */
  async studentQrCodes(studentId: string): Promise<CertQrCode[]> {
    return (await firstValueFrom(this.rawHttp.get<{ ok: boolean; codes: CertQrCode[] }>(`${environment.apiBaseUrl}/certificate-qr`, { params: { student: studentId } }))).codes;
  }

  /** Public: what a scanned QR shows. An unknown token comes back as `status: 'not_found'`. */
  async scan(token: string): Promise<CertScan> {
    try {
      return await firstValueFrom(this.rawHttp.get<CertScan>(`${environment.apiBaseUrl}/certificate-scan/${encodeURIComponent(token)}`));
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) return { status: 'not_found' };
      throw e;
    }
  }

  /** Public: no sign-in needed. A number nobody issued comes back as `status: 'NotFound'`. */
  async verify(number: string): Promise<CertVerification> {
    try {
      return await firstValueFrom(this.rawHttp.get<CertVerification>(`${environment.apiBaseUrl}/verify/${encodeURIComponent(number)}`));
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) return { valid: false, status: 'NotFound' };
      throw e;
    }
  }
}
