import { Component, OnInit, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CertificatesApi } from '../../../shared/common-services/certificates-api.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { CertificateView } from '../../../shared/components/certificate-view/certificate-view';
import { CertTemplate } from '../../../shared/models/certificate.model';
import { CertificateArt } from '../../../shared/utils/certificate-render.util';
import { HeaderActionsDirective } from '../../../shared/directives/header-actions.directive';
import { CanActionDirective } from '../../../shared/directives/can-action.directive';
import { CertificateTemplateForm } from '../certificate-template-form/certificate-template-form';

/** The saved certificate templates as cards with a preview; create, edit and delete them here. */
@Component({
  selector: 'app-certificate-templates',
  standalone: true,
  imports: [CertificateView, CanActionDirective, HeaderActionsDirective],
  templateUrl: './certificate-templates.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', './certificate-templates.scss'],
})
export class CertificateTemplates implements OnInit {
  private readonly api = inject(CertificatesApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<CertTemplate[]>([]);
  protected readonly loaded = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void { void this.load(); }

  private async load(): Promise<void> {
    try {
      this.items.set(await this.api.templates());
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }

  /** A sample certificate in this template's design, for the card preview. */
  protected sample(t: CertTemplate): CertificateArt {
    return { name: 'Student Name', course: 'Course name', score: 92, number: 'SHARP-2026-00001', issued_at: null, issue_date: new Date().toISOString().slice(0, 10), photo: null, design: t.design };
  }

  protected open(t: CertTemplate | null): void {
    this.dialog.open<CertificateTemplateForm, CertTemplate | null, boolean>(CertificateTemplateForm, {
      data: t, width: '1180px', maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', autoFocus: false, restoreFocus: true,
    }).afterClosed().subscribe(saved => { if (saved) void this.load(); });
  }

  protected async remove(t: CertTemplate): Promise<void> {
    if (!(await this.toast.confirm('Delete this template?', `“${t.name}” will be removed. Certificates already made from it keep their design.`))) return;
    try {
      await this.api.deleteTemplate(t.id);
      this.items.update(list => list.filter(i => i.id !== t.id));
      this.toast.success('Template deleted');
    } catch (e) {
      this.toast.error(apiErrorMessage(e));
    }
  }
}
