import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AssessmentsService } from '../../../shared/common-services/assessments.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ToastService } from '../../../shared/common-services/toast.service';
import { AssessType } from '../../../shared/models/assessment.model';

/** Add / rename a question group. */
@Component({
  selector: 'app-group-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './group-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', '../assess-dialog.scss'],
})
export class GroupForm {
  private readonly dialogRef = inject(MatDialogRef<GroupForm>);
  private readonly data = inject<{ id?: string; type: AssessType }>(MAT_DIALOG_DATA);
  private readonly store = inject(AssessmentsService);
  private readonly toast = inject(ToastService);

  readonly isEdit = !!this.data.id;
  readonly noun = this.data.type.toLowerCase();
  readonly submitted = signal(false);
  readonly saving = signal(false);
  title = this.data.id ? this.store.groups.get(this.data.id)?.title ?? '' : '';

  async save(): Promise<void> {
    this.submitted.set(true);
    const title = this.title.trim();
    if (!title || this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.saveGroup(title, this.data.type, this.data.id);
      this.toast.success('Group saved');
      this.dialogRef.close(true);
    } catch (e) {
      this.toast.error(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
