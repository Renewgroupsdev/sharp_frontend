import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { AttendanceRequestsService } from '../../../shared/common-services/attendance-requests.service';
import { ToastService } from '../../../shared/common-services/toast.service';

export const ABSENT_REASONS = ['Medical', 'Family emergency', 'Off-site industry visit', 'Travel problem', 'Other'];

/** Dialog: the student reports Absent for today and must say why. The report goes to the admin, who marks it. */
@Component({
  selector: 'app-attendance-request-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './attendance-request-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class AttendanceRequestForm {
  private readonly ref = inject(MatDialogRef<AttendanceRequestForm, boolean>);
  private readonly requests = inject(AttendanceRequestsService);
  private readonly toast = inject(ToastService);

  protected readonly reasons = ABSENT_REASONS;
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected model = { reason: ABSENT_REASONS[0], detail: '' };

  /** "Other" has no meaning without the detail; for the rest the detail is optional. */
  protected get detailRequired(): boolean { return this.model.reason === 'Other'; }

  protected async save(f: NgForm): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    const detail = this.model.detail.trim();
    if (f.invalid || (this.detailRequired && !detail) || this.saving()) return;
    this.saving.set(true);
    try {
      const reason = this.detailRequired ? detail : detail ? `${this.model.reason} — ${detail}` : this.model.reason;
      await this.requests.submit('Absent', reason);
      this.toast.success('Absence reported', 'The programme office will mark your attendance.');
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
