import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { AssessmentView } from '../components/assessment-view/assessment-view';
import { Assessment } from '../models/assessment.model';
import { AssessmentViewData, assessmentView, myAssessmentView } from '../models/assessment-view.model';
import { MyAssessment } from '../models/my-assessment.model';
import { AssessmentsApi } from './assessments-api.service';

/** Opens the "view assessment" popup from any screen. Staff and students read the document from the same endpoint. */
@Injectable({ providedIn: 'root' })
export class AssessmentViewService {
  private readonly dialog = inject(MatDialog);
  private readonly api = inject(AssessmentsApi);

  /** Emits 'edit' when the user clicks Edit in the popup, nothing otherwise. */
  openStaff(a: Assessment): Observable<string | undefined> {
    return this.open(assessmentView(a, () => this.api.attachmentBlob(a.id)));
  }

  openStudent(a: MyAssessment): void {
    void this.open(myAssessmentView(a, () => this.api.attachmentBlob(a.id)));
  }

  private open(data: AssessmentViewData): Observable<string | undefined> {
    return this.dialog.open<AssessmentView, AssessmentViewData, string>(AssessmentView, { data, width: '760px', maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', autoFocus: false, restoreFocus: true }).afterClosed();
  }
}
