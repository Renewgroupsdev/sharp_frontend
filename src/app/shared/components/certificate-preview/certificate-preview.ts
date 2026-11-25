import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CertificatesService } from '../../common-services/certificates.service';
import { Certificate } from '../../models/certificate.model';
import { verifyUrl } from '../../utils/certificate-render.util';
import { CertificateView } from '../certificate-view/certificate-view';

/** Popup preview of one certificate with Download and Print once it is issued. Used by staff, mentors and students. */
@Component({
  selector: 'app-certificate-preview',
  standalone: true,
  imports: [MatDialogModule, CertificateView],
  templateUrl: './certificate-preview.html',
  styleUrls: ['../../styles/erp-dialog.scss', './certificate-preview.scss'],
})
export class CertificatePreview {
  private readonly ref = inject(MatDialogRef<CertificatePreview>);
  private readonly store = inject(CertificatesService);
  protected readonly cert = inject<Certificate>(MAT_DIALOG_DATA);

  protected readonly issued = this.cert.status === 'Issued';
  protected readonly link = this.cert.number ? verifyUrl(this.cert.number) : '';

  /** The cancellation reason: for "Other" the written note, otherwise the chosen reason plus any note. */
  protected readonly reason = this.cert.cancel_reason === 'Other'
    ? (this.cert.cancel_note ?? 'Other')
    : [this.cert.cancel_reason, this.cert.cancel_note].filter(Boolean).join(': ');

  protected day(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  protected download(): void { this.store.download(this.cert); }
  protected print(): void { this.store.print(this.cert); }
  protected close(): void { this.ref.close(); }
}
