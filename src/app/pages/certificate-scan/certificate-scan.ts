import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { CertificatesApi } from '../../shared/common-services/certificates-api.service';
import { CertificateView } from '../../shared/components/certificate-view/certificate-view';
import { CertScan } from '../../shared/models/certificate.model';

/**
 * Public page behind a student's course QR code. Once the course is finished and the certificate issued it shows the
 * certificate; otherwise it says where the course stands (not completed yet, awaiting approval, cancelled, unknown code).
 */
@Component({
  selector: 'app-certificate-scan',
  standalone: true,
  imports: [CertificateView],
  templateUrl: './certificate-scan.html',
  styleUrl: './certificate-scan.scss',
})
export class CertificateScan implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CertificatesApi);

  protected readonly result = signal<CertScan | null>(null);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.result.set(await this.api.scan(this.route.snapshot.paramMap.get('token') ?? ''));
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    }
  }

  protected day(iso: string | null | undefined): string {
    return iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  }
}
