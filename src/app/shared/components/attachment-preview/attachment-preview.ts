import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AttachmentViewer } from '../attachment-viewer/attachment-viewer';

export interface AttachmentPreviewData {
  name: string;
  size?: string;
  mime?: string | null;
  load: () => Promise<Blob>;
}

/** A popup around AttachmentViewer for any one document. Opened through AttachmentPreviewService. */
@Component({
  selector: 'app-attachment-preview',
  standalone: true,
  imports: [MatDialogModule, AttachmentViewer],
  templateUrl: './attachment-preview.html',
  styleUrl: '../../styles/erp-dialog.scss',
})
export class AttachmentPreview {
  private readonly ref = inject(MatDialogRef<AttachmentPreview>);
  readonly data = inject<AttachmentPreviewData>(MAT_DIALOG_DATA);

  close(): void {
    this.ref.close();
  }
}
