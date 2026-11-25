import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CertificatesApi } from '../../../shared/common-services/certificates-api.service';
import { CertQrCode } from '../../../shared/models/certificate.model';
import { CertQrCard, downloadQrImage, qrStatusLabel, withQrImages } from '../../../shared/utils/certificate-qr.util';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CertificateActionsService } from '../../../shared/common-services/certificate-actions.service';
import { CertificatesService } from '../../../shared/common-services/certificates.service';
import { Certificate } from '../../../shared/models/certificate.model';

const NOTE: Record<string, string> = {
  Pending: 'In review. Your certificate is issued once the programme office approves it.',
  Rejected: 'This certificate was not issued. Contact the programme office if you think this is a mistake.',
  Cancelled: 'This certificate was cancelled and no longer verifies as valid. Contact the programme office.',
};

/** Student "Certificates": issued ones to view, download or print as PDF, and the status of the rest. */
@Component({
  selector: 'app-student-certificates',
  standalone: true,
  templateUrl: './student-certificates.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', '../student.scss', './student-certificates.scss'],
})
export class StudentCertificates implements OnInit {
  private readonly store = inject(CertificatesService);
  private readonly actions = inject(CertificateActionsService);
  private readonly api = inject(CertificatesApi);

  /** One QR per enrolled course, with the picture of the code drawn in the browser. */
  protected readonly qrCodes = signal<CertQrCard[]>([]);
  protected readonly qrLoaded = signal(false);
  protected readonly copied = signal<number | null>(null);

  protected readonly loaded = this.store.loaded;
  protected readonly error = signal<string | null>(null);
  protected readonly items = this.store.items;
  protected readonly issuedCount = computed(() => this.items().filter(c => c.status === 'Issued').length);

  ngOnInit(): void {
    this.store.loadMine().catch(e => this.error.set(apiErrorMessage(e)));
    void this.loadQr();
  }

  private async loadQr(): Promise<void> {
    try {
      const codes = await this.api.myQrCodes();
      this.qrCodes.set(await withQrImages(codes));
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.qrLoaded.set(true);
    }
  }

  protected readonly qrLabel = qrStatusLabel;

  protected qrTone(c: CertQrCode): string { return c.status === 'issued' ? 'g' : c.status === 'in_progress' ? 'w' : c.status === 'completed' ? 'b' : 'd'; }

  protected readonly downloadQr = downloadQrImage;

  protected async copyLink(c: { course_id: number; url: string }): Promise<void> {
    try {
      await navigator.clipboard.writeText(c.url);
      this.copied.set(c.course_id);
      setTimeout(() => this.copied.set(null), 2000);
    } catch { /* the link stays visible to copy by hand */ }
  }

  protected note(c: Certificate): string { return NOTE[c.status] ?? ''; }
  protected tone(c: Certificate): string { return c.status === 'Issued' ? 'g' : c.status === 'Pending' ? 'w' : 'd'; }
  protected day(iso: string | null): string {
    return iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  }

  protected view(c: Certificate): void { this.actions.preview(c); }
  protected download(c: Certificate): void { this.store.download(c); }
  protected print(c: Certificate): void { this.store.print(c); }
}
