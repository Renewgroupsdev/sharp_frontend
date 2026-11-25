import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { CertificatePreview } from '../components/certificate-preview/certificate-preview';
import { Certificate } from '../models/certificate.model';
import { EligibilityError } from './certificates-api.service';
import { CertificatesService } from './certificates.service';
import { ToastService } from './toast.service';

/**
 * The confirm / error handling around each certificate action, shared by the admin list, the mentor review page and the
 * student page. Every method resolves with the updated certificate, or null when the user cancelled or it failed (the
 * error has already been shown).
 */
@Injectable({ providedIn: 'root' })
export class CertificateActionsService {
  private readonly store = inject(CertificatesService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  preview(cert: Certificate): void {
    this.dialog.open(CertificatePreview, { data: cert, width: '860px', maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', autoFocus: false, restoreFocus: true });
  }

  /** Issues the certificate. Below the minimum attendance or score it asks before overriding, and the override is recorded. */
  async issue(cert: Certificate): Promise<Certificate | null> {
    return this.run(async () => {
      try {
        return await this.store.issue(cert.id);
      } catch (e) {
        if (!(e instanceof EligibilityError)) throw e;
        if (!(await this.toast.confirm('Below the minimum', e.message, 'Issue anyway'))) return null;
        return this.store.issue(cert.id, true);
      }
    }, rec => this.toast.success('Certificate issued', rec.number ?? undefined));
  }

  async reject(cert: Certificate): Promise<Certificate | null> {
    if (!(await this.toast.confirm(`Reject ${cert.name}'s certificate?`, cert.course, 'Yes, reject it'))) return null;
    return this.run(() => this.store.reject(cert.id), () => this.toast.success('Certificate rejected'));
  }

  /** Deletes a certificate that is not issued, after confirming. Resolves true when it was deleted. */
  async delete(cert: Certificate): Promise<boolean> {
    const what = cert.number ? `Certificate ${cert.number}` : `${cert.name}'s certificate`;
    if (!(await this.toast.confirm(`Delete ${what}?`, `${cert.course}. This cannot be undone.`))) return false;
    const done = await this.run(async () => {
      await this.store.delete(cert.id);
      return cert;
    }, () => this.toast.success('Certificate deleted'));
    return done !== null;
  }

  /**
   * Cancels an issued certificate. The user picks a reason from the API's list; "Other" asks for a note. The certificate
   * then stops verifying as valid and the student is told the reason.
   */
  async cancel(cert: Certificate): Promise<Certificate | null> {
    let reasons: string[];
    try {
      reasons = await this.store.cancelReasons();
    } catch (e) {
      this.toast.error('Could not load the reasons', apiErrorMessage(e));
      return null;
    }
    const text = `${cert.number} will no longer verify as valid, and ${cert.name} is told why.`;
    const reason = await this.toast.select(`Cancel certificate ${cert.number}?`, 'Reason for cancelling', reasons, 'Cancel certificate', text);
    if (!reason) return null;

    let note: string | undefined;
    if (reason === 'Other') {
      const written = await this.toast.prompt('Other reason', 'Write the reason', 'Cancel certificate');
      if (!written) return null;
      note = written;
    }
    return this.run(() => this.store.cancel(cert.id, reason, note), () => this.toast.success('Certificate cancelled'));
  }

  /** The mentor's recommendation. Returning needs a note, which the student's programme office then sees. */
  async review(cert: Certificate, decision: 'approved' | 'returned'): Promise<Certificate | null> {
    let note: string | undefined;
    if (decision === 'returned') {
      const text = await this.toast.prompt(`Return ${cert.name}'s certificate`, 'Tell the programme office what is missing', 'Return it');
      if (!text) return null;
      note = text;
    }
    return this.run(() => this.store.review(cert.id, decision, note), () => this.toast.success(decision === 'approved' ? 'Approved' : 'Returned', cert.name));
  }

  private async run(action: () => Promise<Certificate | null>, done: (rec: Certificate) => void): Promise<Certificate | null> {
    try {
      const rec = await action();
      if (rec) done(rec);
      return rec;
    } catch (e) {
      this.toast.error('Could not complete that', apiErrorMessage(e));
      return null;
    }
  }
}
