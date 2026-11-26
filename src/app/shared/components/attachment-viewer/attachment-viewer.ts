import { Component, ElementRef, OnDestroy, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { saveBlob } from '../../utils/export.util';
import { repairPptx } from '../../utils/pptx-repair.util';

type PreviewKind = 'pdf' | 'video' | 'image' | 'text' | 'docx' | 'pptx' | 'none';

const IMAGE = /\.(png|jpe?g)$/i;

/**
 * Shows a document inline (PDF, image, text) and offers a download for every type. The file comes from `load`, so the
 * caller decides which authenticated endpoint serves it; nothing here knows about assessments.
 */
@Component({
  selector: 'app-attachment-viewer',
  standalone: true,
  templateUrl: './attachment-viewer.html',
  styleUrl: './attachment-viewer.scss',
})
export class AttachmentViewer implements OnInit, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<string>();
  readonly size = input<string>('');
  readonly mime = input<string | null>(null);
  readonly load = input.required<() => Promise<Blob>>();
  /** Shows the Download button; the document preview popup turns it off. */
  readonly downloadable = input(true);

  readonly kind = computed<PreviewKind>(() => {
    const mime = this.mime() ?? '';
    const name = this.name();
    if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
    if (mime.startsWith('video/') || /.(mp4|webm|mov)$/i.test(name)) return 'video';
    if (mime.startsWith('image/') || IMAGE.test(name)) return 'image';
    if (mime === 'text/plain' || /\.txt$/i.test(name)) return 'text';
    if (/\.docx$/i.test(name) || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
    if (/\.pptx$/i.test(name) || mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
    return 'none';
  });

  /** Where a Word document is drawn; always in the DOM so the renderer has a target. */
  private readonly docHost = viewChild<ElementRef<HTMLElement>>('docHost');

  readonly src = signal<SafeResourceUrl | null>(null);
  readonly rendered = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private pptx: { destroy(): void } | null = null;  private blob: Blob | null = null;
  private objectUrl: string | null = null;

  async ngOnInit(): Promise<void> {
    if (this.kind() === 'none') return;
    this.loading.set(true);
    try {
      const blob = await this.fetch();
      if (this.kind() === 'docx') return await this.renderDocx(blob);
      if (this.kind() === 'pptx') return await this.renderPptx(blob);
      this.objectUrl = URL.createObjectURL(blob);
      this.src.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  /** Word files are drawn in the page by docx-preview (loaded on first use); nothing goes to an outside service. */
  private async renderDocx(blob: Blob): Promise<void> {
    const host = this.docHost()?.nativeElement;
    if (!host) return;
    const { renderAsync } = await import('docx-preview');
    await renderAsync(blob, host, undefined, { inWrapper: false, breakPages: false });
    this.rendered.set(true);
  }

  /** PowerPoint files: every slide is drawn in a scrolling list by pptx-preview (loaded on first use). */
  private async renderPptx(blob: Blob): Promise<void> {
    const host = this.docHost()?.nativeElement;
    if (!host) return;
    const { init } = await import('pptx-preview');
    // The host is still hidden here, so size the slides from its container.
    const width = Math.max(320, (host.parentElement?.clientWidth ?? 720) - 24);
    const previewer = init(host, { width, height: Math.round((width * 9) / 16), mode: 'list' });
    this.pptx = previewer;
    await previewer.preview(await repairPptx(await blob.arrayBuffer()));
    // pptx-preview swallows parse errors and leaves an empty black frame, so an empty result is reported here.
    if (!previewer.slideCount) throw new Error('This presentation could not be previewed. Use Download to open it.');
    this.rendered.set(true);
  }

  async download(): Promise<void> {
    this.error.set(null);
    try {
      saveBlob(await this.fetch(), this.name());
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    }
  }

  ngOnDestroy(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.pptx?.destroy();
  }

  /** One request per viewer: the preview and the download share the fetched file. */
  private async fetch(): Promise<Blob> {
    return (this.blob ??= await this.load()());
  }
}
