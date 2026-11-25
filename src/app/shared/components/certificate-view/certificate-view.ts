import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { CERT_CSS, CertificateArt, certificateHtml } from '../../utils/certificate-render.util';

/**
 * Draws a certificate. The HTML is built by certificateHtml(), which escapes every value, so it is safe to mark as
 * trusted (Angular's own sanitizer would strip the inline SVG QR code and the styling).
 */
@Component({
  selector: 'app-certificate-view',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  styles: [CERT_CSS],
  template: '<div [innerHTML]="html()"></div>',
})
export class CertificateView {
  private readonly sanitizer = inject(DomSanitizer);

  readonly cert = input.required<CertificateArt>();

  protected readonly html = computed(() => this.sanitizer.bypassSecurityTrustHtml(certificateHtml(this.cert())));
}
