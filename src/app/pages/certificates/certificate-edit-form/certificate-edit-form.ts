import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CertificateActionsService } from '../../../shared/common-services/certificate-actions.service';
import { CertificatesService } from '../../../shared/common-services/certificates.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { CertificateView } from '../../../shared/components/certificate-view/certificate-view';
import { CERT_TEMPLATES, CERT_TYPES, Certificate } from '../../../shared/models/certificate.model';
import { CertificateArt } from '../../../shared/utils/certificate-render.util';

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const MAX_SIGNATURE_BYTES = 150 * 1024;

/**
 * Edit a certificate that is not issued yet: its wording, score, minimum attendance, signature, date and status. Choosing
 * "Issued" issues it when saved (below the minimum it asks, or the override box skips the question). An issued certificate
 * is locked, so the action is only offered for Pending and Rejected ones.
 */
@Component({
  selector: 'app-certificate-edit-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule, CertificateView],
  templateUrl: './certificate-edit-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './certificate-edit-form.scss'],
})
export class CertificateEditForm {
  private readonly ref = inject(MatDialogRef<CertificateEditForm, boolean>);
  private readonly store = inject(CertificatesService);
  private readonly actions = inject(CertificateActionsService);
  private readonly toast = inject(ToastService);
  protected readonly cert = inject<Certificate>(MAT_DIALOG_DATA);

  protected readonly templates = CERT_TEMPLATES;
  protected readonly types = CERT_TYPES;
  protected readonly maxDate = todayIso();
  /** A Pending certificate can be left, rejected or issued; a Rejected one can be left or issued. */
  protected readonly statuses = this.cert.status === 'Pending' ? ['Pending', 'Rejected', 'Issued'] : ['Rejected', 'Issued'];
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);

  /** The number it will get on issue (prefix, year, id), shown read-only. */
  protected readonly numberPreview = `${this.store.settings().prefix}-${new Date().getFullYear()}-${String(this.cert.id).padStart(5, '0')}`;

  protected model = {
    template: this.cert.design.template,
    type: this.cert.design.type,
    title: this.cert.design.title,
    body: this.cert.design.body,
    score: this.cert.score === null ? '' : String(this.cert.score),
    minAttendance: String(this.cert.eligibility?.min_attendance ?? this.store.settings().min_attendance),
    signatureName: this.cert.design.signature_name ?? '',
    signatureRole: this.cert.design.signature_role ?? '',
    signatureImage: this.cert.design.signature_image as string | null,
    showProfile: this.cert.design.show_profile,
    showQr: this.cert.design.show_qr,
    override: false,
    status: this.cert.status as string,
    issueDate: this.cert.issue_date ?? '',
  };

  /** The certificate as it will look with the values typed so far. Rebuilt on every edit. */
  protected readonly preview = signal<CertificateArt>(this.draft());

  /** Attendance against the minimum typed in the form. */
  protected readonly attendanceNote = computed(() => {
    this.preview(); // re-evaluate on every edit
    const att = this.cert.attendance;
    if (att === null) return { text: 'No attendance records yet', ok: true };
    const min = Number(this.model.minAttendance) || 0;
    return { text: `${att}% attended · required ${min}%`, ok: att >= min };
  });

  constructor() {
    // The number prefix and the defaults used by "Use programme settings" come from the saved settings.
    this.store.loadSettings().catch(() => undefined);
  }

  private draft(): CertificateArt {
    const m = this.model;
    return {
      name: this.cert.name,
      course: this.cert.course,
      score: m.score === '' ? null : Number(m.score),
      number: this.cert.number,
      issued_at: this.cert.issued_at,
      issue_date: m.issueDate || null,
      design: {
        template: m.template, type: m.type, title: m.title, body: m.body,
        show_profile: m.showProfile, show_qr: m.showQr,
        signature_name: m.signatureName, signature_role: m.signatureRole, signature_image: m.signatureImage,
      },
    };
  }

  protected touch(): void {
    this.preview.set(this.draft());
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
      this.model.signatureImage = String(reader.result);
      this.touch();
    };
    reader.readAsDataURL(file);
  }

  /** Puts everything back to the programme settings and the computed score and minimum. */
  protected async useDefaults(): Promise<void> {
    try {
      await this.store.loadSettings();
    } catch (e) {
      return void this.serverError.set(apiErrorMessage(e));
    }
    const s = this.store.settings();
    Object.assign(this.model, {
      template: s.template, type: s.type, title: s.title, body: s.body,
      signatureName: s.signature_name ?? '', signatureRole: s.signature_role ?? '', signatureImage: s.signature_image,
      showProfile: s.show_profile, showQr: s.show_qr, minAttendance: String(s.min_attendance),
      score: this.cert.score_live === null || this.cert.score_live === undefined ? '' : String(this.cert.score_live),
    });
    this.touch();
  }

  protected async save(): Promise<void> {
    this.serverError.set(null);
    const m = this.model;
    if (!m.title.trim()) return void this.serverError.set('The title is required.');
    if (m.score !== '' && !(Number(m.score) >= 0 && Number(m.score) <= 100)) return void this.serverError.set('The score must be between 0 and 100.');
    if (m.minAttendance !== '' && !(Number(m.minAttendance) >= 0 && Number(m.minAttendance) <= 100)) return void this.serverError.set('The minimum attendance must be between 0 and 100.');
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const saved = await this.store.update(this.cert.id, {
        issue_date: m.issueDate || null,
        score: m.score === '' ? null : Number(m.score),
        min_attendance: m.minAttendance === '' ? null : Number(m.minAttendance),
        design: {
          template: m.template, type: m.type, title: m.title.trim(), body: m.body,
          signature_name: m.signatureName.trim() || null, signature_role: m.signatureRole.trim() || null,
          signature_image: m.signatureImage, show_profile: m.showProfile, show_qr: m.showQr,
        },
      });
      await this.applyStatus(saved);
      this.ref.close(true);
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  /** Details are saved first; then the chosen status is applied (issue, or reject). */
  private async applyStatus(saved: Certificate): Promise<void> {
    if (this.model.status === 'Issued') {
      if (this.model.override) {
        const issued = await this.store.issue(saved.id, true);
        this.toast.success('Certificate issued', issued.number ?? undefined);
      } else {
        await this.actions.issue(saved); // asks before issuing below a minimum
      }
    } else if (this.model.status === 'Rejected' && saved.status === 'Pending') {
      await this.store.reject(saved.id);
      this.toast.success('Certificate rejected');
    } else {
      this.toast.success('Certificate updated');
    }
  }

  protected close(): void {
    this.ref.close(false);
  }
}
