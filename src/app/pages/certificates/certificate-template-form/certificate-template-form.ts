import { Component, computed, inject, signal } from '@angular/core';
import { CertLogosEditor } from '../../../shared/components/cert-logos-editor/cert-logos-editor';
import { CertLogo } from '../../../shared/models/certificate.model';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CertificatesApi } from '../../../shared/common-services/certificates-api.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { CertificateView } from '../../../shared/components/certificate-view/certificate-view';
import { CERT_ACCENTS, CERT_DEFAULT_ACCENT, CERT_TEMPLATES, CERT_TYPES, CertDesign, CertTemplate, defaultCertSettings } from '../../../shared/models/certificate.model';
import { CertificateArt } from '../../../shared/utils/certificate-render.util';

const MAX_SIGNATURE_BYTES = 150 * 1024;

/** Create or edit a certificate template: layout, colour, wording and signature, with a live preview. */
@Component({
  selector: 'app-certificate-template-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule, CertificateView, CertLogosEditor],
  templateUrl: './certificate-template-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './certificate-template-form.scss'],
})
export class CertificateTemplateForm {
  private readonly ref = inject(MatDialogRef<CertificateTemplateForm, boolean>);
  private readonly api = inject(CertificatesApi);
  private readonly toast = inject(ToastService);
  protected readonly existing = inject<CertTemplate | null>(MAT_DIALOG_DATA);

  protected readonly layouts = CERT_TEMPLATES;
  protected readonly types = CERT_TYPES;
  protected readonly accents = CERT_ACCENTS;
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);

  private readonly base: CertDesign = this.existing?.design ?? (({ prefix, min_attendance, min_score, ...design }) => design)(defaultCertSettings());

  protected model = {
    name: this.existing?.name ?? '',
    description: this.existing?.description ?? '',
    template: this.base.template,
    type: this.base.type,
    title: this.base.title,
    body: this.base.body,
    accent: this.base.accent ?? CERT_DEFAULT_ACCENT,
    signatureName: this.base.signature_name ?? '',
    signatureRole: this.base.signature_role ?? '',
    signatureImage: this.base.signature_image as string | null,
    showProfile: this.base.show_profile,
    showQr: this.base.show_qr,
    showLogo: this.base.show_logo !== false,
    logoPosition: (this.base.logo_position ?? 'center') as string,
    logoImage: (this.base.logo_image ?? null) as string | null,
    logos: [...(this.base.logos ?? [])] as CertLogo[],
  };

  /** Bumped on every edit so the preview is rebuilt from the typed values. */
  private readonly tick = signal(0);
  protected readonly preview = computed<CertificateArt>(() => {
    this.tick();
    return {
      name: 'Student Name', course: 'Course name', score: 92, number: 'SHARP-2026-00001', issued_at: null, issue_date: new Date().toISOString().slice(0, 10), photo: null,
      design: this.design(),
    };
  });

  protected touch(): void { this.tick.update(n => n + 1); }

  protected pick(field: 'template' | 'accent', value: string): void {
    this.model[field] = value;
    this.touch();
  }

  private design(): CertDesign {
    const m = this.model;
    return {
      template: m.template, type: m.type, title: m.title.trim(), body: m.body, accent: m.accent,
      show_profile: m.showProfile, show_qr: m.showQr, show_logo: m.showLogo, logo_position: m.logoPosition as 'left' | 'center' | 'right', logos: m.logos, logo_image: m.logoImage,
      signature_name: m.signatureName.trim() || null, signature_role: m.signatureRole.trim() || null, signature_image: m.signatureImage,
    };
  }

  protected onSignature(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > MAX_SIGNATURE_BYTES) {
      this.serverError.set('The signature must be a PNG or JPEG of 150 KB or less.');
      input.value = '';
      return;
    }
    this.serverError.set(null);
    const reader = new FileReader();
    reader.onload = () => { this.model.signatureImage = String(reader.result); this.touch(); };
    reader.readAsDataURL(file);
  }

  protected clearSignature(): void { this.model.signatureImage = null; this.touch(); }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    const m = this.model;
    if (!m.name.trim() || !m.title.trim() || !m.body.trim() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.saveTemplate({ name: m.name.trim(), description: m.description.trim() || null, design: this.design() }, this.existing?.id);
      this.toast.success(this.existing ? 'Template updated' : 'Template created');
      this.ref.close(true);
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected close(): void { this.ref.close(false); }
}
