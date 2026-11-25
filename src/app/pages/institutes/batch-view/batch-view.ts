import { NgClass } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { BatchesService } from '../../../shared/common-services/batches.service';
import { InstituteActionsService } from '../../../shared/common-services/institute-actions.service';
import { CanActionDirective } from '../../../shared/directives/can-action.directive';
import { BATCH_STATUSES } from '../batch-form/batch-form';

/** Batch details: schedule, seats and participating institutes. Closes with `'edit'` when Edit is used. */
@Component({
  selector: 'app-batch-view',
  standalone: true,
  imports: [NgClass, MatDialogModule, CanActionDirective],
  templateUrl: './batch-view.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', '../institute-view/institute-view.scss'],
})
export class BatchView {
  private readonly dialogRef = inject(MatDialogRef<BatchView, 'edit'>);
  private readonly data = inject<{ batchId: string }>(MAT_DIALOG_DATA);
  private readonly store = inject(BatchesService);
  private readonly actions = inject(InstituteActionsService);

  readonly batch = computed(() => this.store.get(this.data.batchId));
  readonly statusLabel = computed(() => BATCH_STATUSES.find(s => s.value === this.batch()?.st)?.label ?? this.batch()?.st ?? '');
  readonly participants = computed(() => { const b = this.batch(); return b ? this.actions.participants(b) : []; });
  readonly allInstitutes = computed(() => !this.batch()?.orgs?.length);

  readonly facts = computed(() => {
    const b = this.batch();
    if (!b) return [];
    return [
      { label: 'Duration', value: `${b.start} – ${b.end}` },
      { label: 'Seats', value: String(b.seats) },
      { label: 'Students assigned', value: String(this.store.studentCount(b)) },
      { label: 'Mentors', value: String(b.mentors) },
    ];
  });

  edit(): void { this.dialogRef.close('edit'); }
  close(): void { this.dialogRef.close(); }

  async remove(): Promise<void> {
    if (await this.actions.removeBatch(this.data.batchId)) this.close();
  }
}
