import { Component, ElementRef, SecurityContext, ViewChild, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';

interface ToolbarButton { cmd: string; value?: string; icon: string; label: string }

const TOOLS: (ToolbarButton | 'sep')[] = [
  { cmd: 'formatBlock', value: 'h2', icon: 'bi-type-h2', label: 'Heading' },
  { cmd: 'formatBlock', value: 'h3', icon: 'bi-type-h3', label: 'Subheading' },
  { cmd: 'formatBlock', value: 'p', icon: 'bi-text-paragraph', label: 'Paragraph' },
  'sep',
  { cmd: 'bold', icon: 'bi-type-bold', label: 'Bold' },
  { cmd: 'italic', icon: 'bi-type-italic', label: 'Italic' },
  { cmd: 'underline', icon: 'bi-type-underline', label: 'Underline' },
  'sep',
  { cmd: 'insertUnorderedList', icon: 'bi-list-ul', label: 'Bulleted list' },
  { cmd: 'insertOrderedList', icon: 'bi-list-ol', label: 'Numbered list' },
  { cmd: 'formatBlock', value: 'blockquote', icon: 'bi-quote', label: 'Quote' },
  'sep',
  { cmd: 'removeFormat', icon: 'bi-eraser', label: 'Clear formatting' },
];

/**
 * Small dependency-free rich text editor (contenteditable + toolbar) that works with ngModel / reactive forms.
 * The value is sanitised HTML; an empty editor is reported as ''. Pasted content is inserted as plain text.
 */
@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RichTextEditor), multi: true }],
  template: `
    <div class="rte" [class.focus]="focused()" [class.disabled]="disabled()">
      <div class="rte-bar" role="toolbar" aria-label="Text formatting">
        @for (t of tools; track $index) {
          @if (t === 'sep') {
            <span class="rte-sep"></span>
          } @else {
            <button type="button" [title]="t.label" [attr.aria-label]="t.label" [disabled]="disabled()" (mousedown)="$event.preventDefault()" (click)="run(t.cmd, t.value)"><i class="bi" [class]="t.icon"></i></button>
          }
        }
        <button type="button" title="Link" aria-label="Link" [disabled]="disabled()" (mousedown)="$event.preventDefault()" (click)="link()"><i class="bi bi-link-45deg"></i></button>
      </div>
      <div
        #area
        class="rte-area"
        role="textbox"
        aria-multiline="true"
        [attr.id]="inputId()"
        [attr.contenteditable]="disabled() ? 'false' : 'true'"
        [attr.data-placeholder]="placeholder()"
        [style.min-height.px]="minHeight()"
        (input)="onInput()"
        (focus)="focused.set(true)"
        (blur)="focused.set(false); onTouched()"
        (paste)="onPaste($event)"></div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .rte { border: 1px solid var(--border-soft, #d9dde5); border-radius: 10px; background: var(--app-surface-solid, #fff); overflow: hidden; }
    .rte.focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
    .rte.disabled { opacity: .6; }
    .rte-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 6px; border-bottom: 1px solid var(--border-soft, #e6e9ef); background: var(--primary-soft); }
    .rte-bar button { width: 30px; height: 30px; border: 0; border-radius: 6px; background: transparent; color: var(--text-dark); cursor: pointer; }
    .rte-bar button:hover:not(:disabled) { background: var(--app-surface-solid, #fff); color: var(--primary); }
    .rte-sep { width: 1px; height: 18px; margin: 0 4px; background: var(--border-soft, #d9dde5); }
    .rte-area { padding: 10px 12px; outline: none; font-size: 13px; line-height: 1.55; color: var(--text-dark); overflow-wrap: anywhere; max-height: 360px; overflow-y: auto; }
    .rte-area:empty::before { content: attr(data-placeholder); color: var(--text-muted); pointer-events: none; }
    .rte-area :is(h2, h3) { margin: 10px 0 6px; font-weight: 700; }
    .rte-area h2 { font-size: 18px; }
    .rte-area h3 { font-size: 15px; }
    .rte-area :is(ul, ol) { margin: 6px 0; padding-left: 22px; }
    .rte-area blockquote { margin: 8px 0; padding: 4px 12px; border-left: 3px solid var(--primary); color: var(--text-muted); }
    .rte-area a { color: var(--primary); text-decoration: underline; }
  `],
})
export class RichTextEditor implements ControlValueAccessor {
  private readonly sanitizer = inject(DomSanitizer);

  readonly placeholder = input('Write here…');
  readonly minHeight = input(160);
  readonly inputId = input<string | null>(null);

  @ViewChild('area', { static: true }) private readonly area!: ElementRef<HTMLDivElement>;

  readonly tools = TOOLS;
  readonly focused = signal(false);
  readonly disabled = signal(false);

  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.area.nativeElement.innerHTML = this.sanitizer.sanitize(SecurityContext.HTML, value ?? '') ?? '';
  }

  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }

  run(cmd: string, value?: string): void {
    this.area.nativeElement.focus();
    document.execCommand(cmd, false, value ? `<${value}>` : undefined);
    this.onInput();
  }

  link(): void {
    const url = window.prompt('Link address (https://…)')?.trim();
    if (!url) return;
    if (!/^(https?:\/\/|mailto:)/i.test(url)) { window.alert('Use a link that starts with http://, https:// or mailto:'); return; }
    this.area.nativeElement.focus();
    document.execCommand('createLink', false, url);
    this.onInput();
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') ?? '');
  }

  onInput(): void {
    const el = this.area.nativeElement;
    this.onChange(el.textContent?.trim() || el.querySelector('img') ? el.innerHTML : '');
  }
}
