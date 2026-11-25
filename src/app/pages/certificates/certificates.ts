import { Component, signal } from '@angular/core';
import { CertificateList } from './certificate-list/certificate-list';
import { CertificateSettings } from './certificate-settings/certificate-settings';

type Tab = 'list' | 'settings';

/** Certificate Management: the list of every certificate, and the settings (template, numbering, minimum attendance and score). */
@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [CertificateList, CertificateSettings],
  templateUrl: './certificates.html',
  styleUrls: ['../../shared/styles/erp-page.scss', '../assessments/assessments.scss'],
})
export class Certificates {
  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'list', label: 'Certificates', icon: 'bi-award' },
    { key: 'settings', label: 'Certificate settings', icon: 'bi-sliders' },
  ];
  readonly tab = signal<Tab>('list');
}
