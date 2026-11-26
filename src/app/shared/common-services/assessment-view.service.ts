import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { AssessmentView } from '../components/assessment-view/assessment-view';
import { Assessment } from '../models/assessment.model';
import { AssessmentViewData, assessmentView } from '../models/assessment-view.model';
import { MyAssessment } from '../models/my-assessment.model';
import { AssessmentsApi } from './assessments-api.service';
import { AttachmentPreviewService } from './attachment-preview.service';
import { ToastService } from './toast.service';

/** Opens the "view assessment" popup from any screen. Staff and students read the document from the same endpoint. */
@Injectable({ providedIn: 'root' })
export class AssessmentViewService {
  private readonly dialog = inject(MatDialog);
  private readonly api = inject(AssessmentsApi);
  private readonly preview = inject(AttachmentPreviewService);
  private readonly toast = inject(ToastService);

  /** Emits 'edit' when the user clicks Edit in the popup, nothing otherwise. */
  openStaff(a: Assessment): Observable<string | undefined> {
    return this.open(assessmentView(a, () => this.api.attachmentBlob(a.id)));
  }

  /** Students see only a preview of the uploaded document, not the assignment details. */
  openStudent(a: MyAssessment): void {
    const file = a.attachment;
    if (!file) { this.toast.info('No document', 'This assignment has no document attached.'); return; }
    if (file.available === false) { this.toast.warning('Document not available', 'Ask your instructor to upload it again.'); return; }
    this.preview.open({ name: file.name, size: file.size, mime: file.mime ?? null, load: () => this.api.attachmentBlob(a.id) });
  }

  private open(data: AssessmentViewData): Observable<string | undefined> {
    return this.dialog.open<AssessmentView, AssessmentViewData, string>(AssessmentView, { data, width: '760px', maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', autoFocus: false, restoreFocus: true }).afterClosed();
  }
}
