import { NgClass } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { BatchesService } from '../../../shared/common-services/batches.service';
import { InstituteActionsService } from '../../../shared/common-services/institute-actions.service';
import { InstitutesService } from '../../../shared/common-services/institutes.service';
import { CanActionDirective } from '../../../shared/directives/can-action.directive';

/** Institute profile with its headcount and batches. Closes with `'edit'` when the Edit button is used. */
@Component({
  selector: 'app-institute-view',
  standalone: true,
  imports: [NgClass, MatDialogModule, CanActionDirective],
  templateUrl: './institute-view.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './institute-view.scss'],
})
export class InstituteView {
  private readonly dialogRef = inject(MatDialogRef<InstituteView, 'edit'>);
  private readonly data = inject<{ instituteId: string }>(MAT_DIALOG_DATA);
  private readonly store = inject(InstitutesService);
  private readonly batchStore = inject(BatchesService);
  private readonly actions = inject(InstituteActionsService);

  readonly institute = computed(() => this.store.get(this.data.instituteId));
  readonly students = computed(() => { const o = this.institute(); return o ? this.store.studentCount(o) : 0; });

  /** Batches this institute takes part in (a batch with no institute list includes everyone). */
  readonly batches = computed(() => {
    const o = this.institute();
    return o ? this.batchStore.items().filter(b => !b.orgs?.length || b.orgs.includes(o.n)) : [];
  });

  readonly facts = computed(() => {
    const o = this.institute();
    if (!o) return [];
    return [
      { label: 'Code', value: o.code },
      { label: 'City', value: o.city },
      { label: 'Principal / contact', value: o.pr },
      { label: 'Phone', value: o.ph },
      { label: 'Email', value: o.email },
      { label: 'Students enrolled', value: String(this.students()) },
    ];
  });

  edit(): void { this.dialogRef.close('edit'); }
  close(): void { this.dialogRef.close(); }

  async remove(): Promise<void> {
    if (await this.actions.removeInstitute(this.data.instituteId)) this.close();
  }
}
