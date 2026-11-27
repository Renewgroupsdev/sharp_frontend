import { Injectable, computed, inject, signal } from '@angular/core';
import { CertSettings, Certificate, defaultCertSettings } from '../models/certificate.model';
import { certificateDocument } from '../utils/certificate-render.util';
import { saveBlob } from '../utils/export.util';
import { ActivityLogService } from './activity-log.service';
import { CertificateEdit, CertificateFilters, CertificatesApi } from './certificates-api.service';

const MODULE_NAME = 'Certificate Management';

/**
 * Certificates and the certificate settings, from the API. Staff and mentors load the list; a student loads their own.
 * Each action replaces the row with the server's answer, so the list never drifts from the database.
 */
@Injectable({ providedIn: 'root' })
export class CertificatesService {
  private readonly api = inject(CertificatesApi);
  private readonly log = inject(ActivityLogService);

  readonly items = signal<Certificate[]>([]);
  readonly settings = signal<CertSettings>(defaultCertSettings());
  readonly loaded = signal(false);

  readonly pending = computed(() => this.items().filter(c => c.status === 'Pending'));
  /** Pending ones the mentor has not looked at yet. */
  readonly awaitingMentor = computed(() => this.pending().filter(c => !c.mentor?.decision));

  async load(filters: CertificateFilters = {}): Promise<void> {
    this.items.set(await this.api.list(filters as Record<string, string | number | undefined>));
    this.loaded.set(true);
  }

  /** The signed-in student's own certificates. */
  async loadMine(): Promise<void> {
    this.items.set(await this.api.mine());
    this.loaded.set(true);
  }

  async loadSettings(): Promise<void> {
    this.settings.set(await this.api.getSettings());
  }

  async create(studentId: string, courseId: number, templateId?: number | null): Promise<Certificate> {
    const rec = await this.api.createFor(studentId, courseId, templateId);
    this.items.update(list => [rec, ...list]);
    this.log.record(MODULE_NAME, `Created certificate for ${rec.name} — ${rec.course}`);
    return rec;
  }

  /** Throws EligibilityError when below the minimums; call again with `override` to issue anyway. */
  async issue(id: number, override = false): Promise<Certificate> {
    const rec = await this.api.issue(id, override);
    this.replace(rec);
    this.log.record(MODULE_NAME, `Issued certificate ${rec.number} to ${rec.name}${override ? ' (eligibility override)' : ''}`);
    return rec;
  }

  async update(id: number, body: CertificateEdit): Promise<Certificate> {
    const rec = await this.api.edit(id, body);
    this.replace(rec);
    this.log.record(MODULE_NAME, `Updated certificate details for ${rec.name} — ${rec.course}`);
    return rec;
  }

  async reject(id: number): Promise<Certificate> {
    const rec = await this.api.reject(id);
    this.replace(rec);
    this.log.record(MODULE_NAME, `Rejected certificate for ${rec.name} — ${rec.course}`);
    return rec;
  }

  /** Deletes a certificate that is not issued (the API refuses an issued one: cancel it first). */
  async delete(id: number): Promise<void> {
    const rec = this.items().find(c => c.id === id);
    await this.api.remove(id);
    this.items.update(list => list.filter(c => c.id !== id));
    this.log.record(MODULE_NAME, `Deleted certificate for ${rec?.name ?? id}${rec ? ` — ${rec.course}` : ''}`);
  }

  async cancel(id: number, reason: string, note?: string): Promise<Certificate> {
    const rec = await this.api.cancel(id, reason, note);
    this.replace(rec);
    this.log.record(MODULE_NAME, `Cancelled certificate ${rec.number} for ${rec.name} — ${reason}`);
    return rec;
  }

  cancelReasons(): Promise<string[]> {
    return this.api.cancelReasons();
  }

  async review(id: number, decision: 'approved' | 'returned', note?: string): Promise<Certificate> {
    const rec = await this.api.review(id, decision, note);
    this.replace(rec);
    return rec;
  }

  /** `next.signature_image` holds the current or newly chosen signature; `removeSignature` clears it. */
  async saveSettings(next: CertSettings, removeSignature = false): Promise<void> {
    this.settings.set(await this.api.saveSettings({ ...next, remove_signature_image: removeSignature }));
    this.log.record(MODULE_NAME, 'Updated certificate settings');
  }

  /** Saves the certificate as a stand-alone HTML file that opens offline. */
  download(c: Certificate): void {
    saveBlob(new Blob([certificateDocument(c)], { type: 'text/html;charset=utf-8' }), `${c.number ?? 'certificate'}.html`);
  }

  /** Opens the browser's print dialog for the certificate; choose "Save as PDF" there. */
  print(c: Certificate): void {
    const win = window.open('', '_blank', 'width=1000,height=760');
    if (!win) return;
    win.document.write(certificateDocument(c));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  private replace(rec: Certificate): void {
    this.items.update(list => list.map(c => (c.id === rec.id ? rec : c)));
  }
}
