import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CertificatesApi } from '../../../shared/common-services/certificates-api.service';
import { CertificatesService } from '../../../shared/common-services/certificates.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { UsersService } from '../../../shared/common-services/users.service';
import { CertificateView } from '../../../shared/components/certificate-view/certificate-view';
import { CertDesign, CertTemplate } from '../../../shared/models/certificate.model';
import { CertificateArt } from '../../../shared/utils/certificate-render.util';

/** Create a Pending certificate for a student and course, in the programme design or one of the saved templates. */
@Component({
  selector: 'app-certificate-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule, CertificateView],
  templateUrl: './certificate-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './certificate-form.scss'],
})
export class CertificateForm implements OnInit {
  private readonly ref = inject(MatDialogRef<CertificateForm, boolean>);
  private readonly store = inject(CertificatesService);
  private readonly api = inject(CertificatesApi);
  private readonly toast = inject(ToastService);

  protected readonly students = inject(UsersService).students();
  protected readonly courses = inject(CoursesService).live();
  protected readonly templates = signal<CertTemplate[]>([]);
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected model = { studentId: '', courseId: '' };
  /** 0 = the programme design from Certificate settings. */
  protected readonly templateId = signal(0);
  /** Bumped when a select changes so the preview follows the chosen student and course. */
  private readonly tick = signal(0);

  protected readonly valid = computed(() => !!this.model.studentId && !!this.model.courseId);

  /** The design the certificate will start from. */
  protected readonly design = computed<CertDesign>(() => this.templates().find(t => t.id === this.templateId())?.design ?? this.store.settings());

  protected readonly preview = computed<CertificateArt>(() => {
    this.tick();
    const student = this.students.find(s => String(s.id) === this.model.studentId);
    const course = this.courses.find(c => String(c.id) === this.model.courseId);
    return {
      name: student?.n ?? 'Student Name', course: course?.title ?? 'Course name', score: 90, number: 'SHARP-2026-00001', issued_at: null,
      issue_date: new Date().toISOString().slice(0, 10), photo: student?.pic ?? null, design: this.design(),
    };
  });

  ngOnInit(): void {
    this.store.loadSettings().catch(() => undefined);
    this.api.templates().then(list => this.templates.set(list)).catch(() => undefined);
  }

  protected touch(): void { this.tick.update(n => n + 1); }

  protected accentOf(d: CertDesign): string { return d.accent || '#0E7A4E'; }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.create(this.model.studentId, Number(this.model.courseId), this.templateId() || null);
      this.toast.success('Certificate created', 'It is waiting for review.');
      this.ref.close(true);
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected close(): void {
    this.ref.close(false);
  }
}
