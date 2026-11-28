import { Component, OnInit, inject, output, signal } from '@angular/core';
import { CertLogosEditor } from '../../../shared/components/cert-logos-editor/cert-logos-editor';
import { FormsModule } from '@angular/forms';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CertificatesService } from '../../../shared/common-services/certificates.service';
import { UsersService } from '../../../shared/common-services/users.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { CertificateView } from '../../../shared/components/certificate-view/certificate-view';
import { CanActionDirective } from '../../../shared/directives/can-action.directive';
import { CertificatesApi } from '../../../shared/common-services/certificates-api.service';
import { CERT_ACCENTS, CERT_TEMPLATES, CERT_TYPES, CertSettings, CertTemplate, defaultCertSettings } from '../../../shared/models/certificate.model';
import { CertificateArt } from '../../../shared/utils/certificate-render.util';

const MAX_SIGNATURE_BYTES = 150 * 1024;

/** The template, wording, numbering and minimum attendance / score used for every certificate. */
@Component({
  selector: 'app-certificate-settings',
  standalone: true,
  imports: [FormsModule, CertificateView, CanActionDirective, CertLogosEditor],
  templateUrl: './certificate-settings.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', '../../../shared/styles/erp-page.scss', './certificate-settings.scss'],
})
export class CertificateSettings implements OnInit {
  private readonly store = inject(CertificatesService);
  private readonly courses = inject(CoursesService);
  private readonly toast = inject(ToastService);
  private readonly api = inject(CertificatesApi);
  private readonly users = inject(UsersService);

  /** Asks the page to switch to the Templates tab. */
  readonly openTemplates = output<void>();
  protected readonly saved = signal<CertTemplate[]>([]);
  protected readonly accents = CERT_ACCENTS;
  protected readonly layouts = CERT_TEMPLATES;
  protected readonly types = CERT_TYPES;
  protected readonly saving = signal(false);
  protected readonly removeSignature = signal(false);
  protected readonly loading = signal(true);
  protected readonly serverError = signal<string | null>(null);

  protected model: CertSettings = defaultCertSettings();

  /** A made-up certificate drawn with the settings being edited, so a change can be seen before saving. Rebuilt on every edit. */
  protected readonly preview = signal<CertificateArt>(this.sample());

  /** A real student with a profile picture, so the preview shows how a photo looks. */
  private demo() { const all = this.users.students(); return all.find(s => s.pic) ?? all[0]; }

  private sample(): CertificateArt {
    return {
      name: this.demo()?.n ?? 'Priya R',
      photo: this.demo()?.pic ?? null,
      course: this.courses.live()[0]?.title ?? 'Communication Skills',
      score: 86,
      number: `${(this.model.prefix || 'SHARP').toUpperCase()}-${new Date().getFullYear()}-00001`,
      issued_at: new Date().toISOString(),
      design: { ...this.model, signature_image: this.removeSignature() ? null : this.model.signature_image },
    };
  }

  async ngOnInit(): Promise<void> {
    try {
      this.api.templates().then(list => this.saved.set(list)).catch(() => undefined);
      await this.store.loadSettings();
      this.model = { ...this.store.settings() };
      this.touch();
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected pick(field: 'template' | 'accent', value: string): void {
    this.model[field] = value;
    this.touch();
  }

  /** Copies a saved template's design into the form; nothing is saved until Save settings. */
  protected applyTemplate(id: number): void {
    const t = this.saved().find(x => x.id === id);
    if (!t) return;
    const d = t.design;
    this.model = {
      ...this.model, template: d.template, type: d.type, title: d.title, body: d.body, accent: d.accent ?? null,
      show_profile: d.show_profile, show_qr: d.show_qr, show_logo: d.show_logo !== false, logo_position: d.logo_position ?? 'center', logo_image: d.logo_image ?? null, logos: [...(d.logos ?? [])], signature_name: d.signature_name, signature_role: d.signature_role,
      signature_image: d.signature_image,
    };
    this.removeSignature.set(!d.signature_image);
    this.touch();
    this.toast.success('Template copied', 'Review it, then press Save settings.');
  }

  protected touch(): void {
    this.preview.set(this.sample());
  }

  protected onSignature(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      this.toast.error('Use a PNG or JPEG image');
      input.value = '';
      return;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      this.toast.error('The signature image must be 150 KB or smaller');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.model.signature_image = String(reader.result);
      this.removeSignature.set(false);
      this.touch();
    };
    reader.readAsDataURL(file);
  }

  protected clearSignature(): void {
    this.model.signature_image = null;
    this.removeSignature.set(true);
    this.touch();
  }

  protected async save(): Promise<void> {
    this.serverError.set(null);
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.saveSettings({ ...this.model, prefix: this.model.prefix.trim().toUpperCase() }, this.removeSignature());
      this.model = { ...this.store.settings() };
      this.removeSignature.set(false);
      this.touch();
      this.toast.success('Certificate settings saved');
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}
