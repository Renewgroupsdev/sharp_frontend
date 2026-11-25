import { Component, OnInit, inject, signal } from '@angular/core';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CertificateActionsService } from '../../../shared/common-services/certificate-actions.service';
import { CertificatesService } from '../../../shared/common-services/certificates.service';
import { Certificate } from '../../../shared/models/certificate.model';
import { initials } from '../../../shared/utils/format.util';

/**
 * Mentor Certificate Review: the mentor confirms (or returns with a note) the certificates of their own batch. The
 * programme office then issues them, so a recommendation never issues anything by itself.
 */
@Component({
  selector: 'app-certificate-review',
  standalone: true,
  templateUrl: './certificate-review.html',
  styleUrls: ['../mentor.scss'],
})
export class CertificateReview implements OnInit {
  private readonly store = inject(CertificatesService);
  private readonly actions = inject(CertificateActionsService);

  protected readonly waiting = this.store.pending;
  protected readonly loaded = this.store.loaded;
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.store.load({ status: 'Pending' }).catch(e => this.error.set(apiErrorMessage(e)));
  }

  protected initialsOf(name: string): string { return initials(name); }
  protected view(c: Certificate): void { this.actions.preview(c); }
  protected approve(c: Certificate): void { void this.actions.review(c, 'approved'); }
  protected returnCert(c: Certificate): void { void this.actions.review(c, 'returned'); }
}
