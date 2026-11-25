import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AttachmentPreview, AttachmentPreviewData } from '../components/attachment-preview/attachment-preview';

/** Opens any single document in the preview popup. */
@Injectable({ providedIn: 'root' })
export class AttachmentPreviewService {
  private readonly dialog = inject(MatDialog);

  open(data: AttachmentPreviewData): void {
    this.dialog.open(AttachmentPreview, { data, width: '860px', maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', autoFocus: false, restoreFocus: true });
  }
}
