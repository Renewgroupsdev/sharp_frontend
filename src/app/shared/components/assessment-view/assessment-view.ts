import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AssessmentViewData } from '../../models/assessment-view.model';
import { CanActionDirective } from '../../directives/can-action.directive';
import { AttachmentViewer } from '../attachment-viewer/attachment-viewer';

/** Read-only popup for a quiz, assignment or assessment, with its document. Opened through AssessmentViewService. */
@Component({
  selector: 'app-assessment-view',
  standalone: true,
  imports: [MatDialogModule, AttachmentViewer, CanActionDirective],
  templateUrl: './assessment-view.html',
  styleUrls: ['../../styles/erp-dialog.scss', './assessment-view.scss'],
})
export class AssessmentView {
  private readonly ref = inject(MatDialogRef<AssessmentView, string | undefined>);
  readonly data = inject<AssessmentViewData>(MAT_DIALOG_DATA);

  get icon(): string {
    return { Quiz: 'bi-patch-question', Assignment: 'bi-file-earmark-text', Assessment: 'bi-patch-check' }[this.data.type] ?? 'bi-journal-text';
  }

  /** Closes with 'edit' so the opener can show the edit form. */
  edit(): void {
    this.ref.close('edit');
  }

  close(): void {
    this.ref.close();
  }
}
