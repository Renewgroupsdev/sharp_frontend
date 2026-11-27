import { AuthService } from '../../core/auth/auth.service';
import { Component, inject, signal } from '@angular/core';
import { HeaderActions } from '../../shared/directives/header-actions.directive';
import { NgTemplateOutlet } from '@angular/common';
import { CertificateList } from './certificate-list/certificate-list';
import { CertificateSettings } from './certificate-settings/certificate-settings';
import { CertificateTemplates } from './certificate-templates/certificate-templates';

type Tab = 'list' | 'templates' | 'settings';

/** Certificate Management: the list of every certificate, and the settings (template, numbering, minimum attendance and score). */
@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [NgTemplateOutlet, CertificateList, CertificateTemplates, CertificateSettings],
  templateUrl: './certificates.html',
  styleUrls: ['../../shared/styles/erp-page.scss', '../assessments/assessments.scss', './certificates.scss'],
})
export class Certificates {
  protected readonly actions = inject(HeaderActions);
  private readonly auth = inject(AuthService);
  private readonly allTabs: { key: Tab; label: string; icon: string; slug: string }[] = [
    { key: 'list', label: 'Certificates', icon: 'bi-award', slug: 'a_certs.tab.list' },
    { key: 'templates', label: 'Templates', icon: 'bi-palette', slug: 'a_certs.tab.templates' },
    { key: 'settings', label: 'Certificate settings', icon: 'bi-sliders', slug: 'a_certs.tab.settings' },
  ];
  /** Only the tabs this role is given on Roles & Permissions. */
  readonly tabs = this.allTabs.filter(t => this.auth.hasTab(t.slug));
  readonly tab = signal<Tab>(this.tabs[0]?.key ?? 'list');
}
