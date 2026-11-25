import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CertificatesService } from '../../../shared/common-services/certificates.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { UsersService } from '../../../shared/common-services/users.service';

/** Create a Pending certificate for a student and course; it is issued from the list once reviewed. */
@Component({
  selector: 'app-certificate-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './certificate-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class CertificateForm {
  private readonly ref = inject(MatDialogRef<CertificateForm, boolean>);
  private readonly store = inject(CertificatesService);
  private readonly toast = inject(ToastService);

  protected readonly students = inject(UsersService).students();
  protected readonly courses = inject(CoursesService).live();
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly valid = computed(() => !!this.model.studentId && !!this.model.courseId);

  protected model = { studentId: '', courseId: '' };

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.create(this.model.studentId, Number(this.model.courseId));
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
