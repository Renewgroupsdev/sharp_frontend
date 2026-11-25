import { Component, inject, input, signal } from '@angular/core';
import { AssessmentsApi } from '../../common-services/assessments-api.service';
import { AttachmentPreviewService } from '../../common-services/attachment-preview.service';
import { SubmissionAttachment } from '../../models/my-assessment.model';
import { humanSize } from '../../utils/upload.util';

/** The files a student attached to one submission, each with View (popup preview). Saving a file is for admins, on the Submissions page. */
@Component({
  selector: 'app-submission-files',
  standalone: true,
  templateUrl: './submission-files.html',
  styleUrl: './submission-files.scss',
})
export class SubmissionFiles {
  private readonly api = inject(AssessmentsApi);
  private readonly preview = inject(AttachmentPreviewService);

  readonly files = input.required<SubmissionAttachment[]>();
  readonly error = signal<string | null>(null);

  readonly sizeOf = (f: SubmissionAttachment): string => humanSize(f.size);

  view(f: SubmissionAttachment): void {
    this.preview.open({ name: f.name, size: this.sizeOf(f), mime: f.mime_type, load: () => this.api.viewAttachment(f.id) });
  }
}
