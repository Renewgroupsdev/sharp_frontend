import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { CertificatesApi } from '../../shared/common-services/certificates-api.service';
import { CertVerification } from '../../shared/models/certificate.model';

/** Public page behind a certificate's QR code: tells anyone whether a number is a genuine, still valid certificate. */
@Component({
  selector: 'app-certificate-verify',
  standalone: true,
  templateUrl: './certificate-verify.html',
  styleUrl: './certificate-verify.scss',
})
export class CertificateVerify implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CertificatesApi);

  protected readonly number = this.route.snapshot.paramMap.get('number') ?? '';
  protected readonly result = signal<CertVerification | null>(null);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.result.set(await this.api.verify(this.number));
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    }
  }

  protected day(iso: string | null | undefined): string {
    return iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  }
}
