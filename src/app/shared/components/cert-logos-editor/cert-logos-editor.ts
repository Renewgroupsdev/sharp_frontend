import { Component, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CertLogo, LOGO_POSITIONS } from '../../models/certificate.model';

const MAX_LOGOS = 4;
const MAX_BYTES = 150 * 1024;
const DEFAULT_SHARP = '/assets/sharp-logo.svg';

/**
 * The logos of a certificate: the SHARP logo (shown or hidden, replaceable by an upload, with its position) and up to four
 * more uploaded logos, each with its own position (top left, centre or right).
 */
@Component({
  selector: 'app-cert-logos-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="cl">
      <div class="cl-row" [class.off]="!showSharp()">
        <img class="cl-img" [src]="sharpImage() || defaultSharp" alt="SHARP logo" />
        <div class="cl-main">
          <label class="cl-sw"><input type="checkbox" [ngModel]="showSharp()" (ngModelChange)="showSharp.set($event); changed.emit()" [ngModelOptions]="{ standalone: true }" /> <span>SHARP logo</span></label>
          <div class="cl-btns">
            <label class="cl-btn"><i class="bi bi-upload"></i> {{ sharpImage() ? 'Replace' : 'Upload your own' }}<input type="file" hidden accept="image/png,image/jpeg" (change)="onSharp($event)" /></label>
            @if (sharpImage()) { <button type="button" class="cl-btn" (click)="resetSharp()"><i class="bi bi-arrow-counterclockwise"></i> Use the default</button> }
          </div>
        </div>
        <div class="cl-pos">
          <label for="cl-pos-sharp">Position</label>
          <select id="cl-pos-sharp" [ngModel]="sharpPosition()" (ngModelChange)="sharpPosition.set($event); changed.emit()" [ngModelOptions]="{ standalone: true }" [disabled]="!showSharp()">
            @for (p of positions; track p) { <option [value]="p">{{ label(p) }}</option> }
          </select>
        </div>
      </div>

      @for (l of logos(); track $index) {
        <div class="cl-row">
          <img class="cl-img" [src]="l.image" [alt]="'Logo ' + ($index + 1)" />
          <div class="cl-main"><b class="cl-name">Logo {{ $index + 1 }}</b></div>
          <div class="cl-pos">
            <label [for]="'cl-pos-' + $index">Position</label>
            <select [id]="'cl-pos-' + $index" [ngModel]="l.position" (ngModelChange)="setPosition($index, $event)" [ngModelOptions]="{ standalone: true }">
              @for (p of positions; track p) { <option [value]="p">{{ label(p) }}</option> }
            </select>
          </div>
          <button type="button" class="cl-x" (click)="remove($index)" aria-label="Remove this logo"><i class="bi bi-trash3"></i></button>
        </div>
      }
      @if (logos().length < max) {
        <label class="cl-add"><i class="bi bi-plus-circle"></i> Add another logo<input type="file" hidden accept="image/png,image/jpeg" (change)="onFile($event)" /></label>
      }
      <small class="cl-hint">PNG or JPEG, 150 KB or smaller. Each logo has its own position.</small>
      @if (error()) { <small class="cl-err" role="alert">{{ error() }}</small> }
    </div>
  `,
  styles: `
    .cl { display: flex; flex-direction: column; gap: 8px; }
    .cl-row { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid #E4E7EC; border-radius: 10px; background: #fff; &.off { opacity: .6; } }
    .cl-img { width: 84px; height: 46px; object-fit: contain; border: 1px solid #EAECF0; border-radius: 6px; background: #F9FAFB; flex: 0 0 auto; }
    .cl-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
    .cl-name { font-size: 13px; color: #344054; }
    .cl-sw { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #344054; cursor: pointer; input { accent-color: #080536; } }
    .cl-btns { display: flex; flex-wrap: wrap; gap: 6px; }
    .cl-btn { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border: 1px solid #D0D5DD; border-radius: 8px; background: #fff; font: inherit; font-size: 12px; font-weight: 600; color: #080536; cursor: pointer; &:hover { background: #F2F4F7; } }
    .cl-pos { display: flex; flex-direction: column; gap: 2px; label { font-size: 11.5px; font-weight: 600; color: #475467; } select { padding: 6px 8px; border: 1px solid #D0D5DD; border-radius: 8px; font: inherit; font-size: 13px; } }
    .cl-x { border: 0; background: none; color: #B42318; font-size: 16px; cursor: pointer; }
    .cl-add { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border: 1px dashed #98A2B3; border-radius: 8px; font-size: 13px; font-weight: 600; color: #080536; cursor: pointer; &:hover { background: #F2F4F7; } }
    .cl-hint { color: #667085; font-size: 11.5px; }
    .cl-err { color: #B42318; font-size: 12px; }
  `,
})
export class CertLogosEditor {
  readonly showSharp = model<boolean>(true);
  readonly sharpPosition = model<string>('center');
  /** An uploaded replacement for the SHARP logo; null means the built-in one. */
  readonly sharpImage = model<string | null>(null);
  readonly logos = model<CertLogo[]>([]);
  /** Fires after any change, so the form can refresh its live preview. */
  readonly changed = output<void>();

  protected readonly positions = LOGO_POSITIONS;
  protected readonly max = MAX_LOGOS;
  protected readonly defaultSharp = DEFAULT_SHARP;
  protected readonly error = signal('');
  protected label(p: string): string { return p === 'left' ? 'Top left' : p === 'right' ? 'Top right' : 'Top centre'; }

  private read(event: Event, done: (dataUrl: string) => void): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > MAX_BYTES) return void this.error.set('A logo must be a PNG or JPEG of 150 KB or less.');
    this.error.set('');
    const reader = new FileReader();
    reader.onload = () => { done(String(reader.result)); this.changed.emit(); };
    reader.readAsDataURL(file);
  }

  protected onSharp(event: Event): void { this.read(event, url => { this.sharpImage.set(url); this.showSharp.set(true); }); }

  protected resetSharp(): void { this.sharpImage.set(null); this.changed.emit(); }

  protected onFile(event: Event): void {
    this.read(event, image => {
      // Start each new logo on a side no other logo uses, when there is one.
      const used = new Set([...(this.showSharp() ? [this.sharpPosition()] : []), ...this.logos().map(l => l.position)]);
      const position = (['left', 'right', 'center'] as const).find(p => !used.has(p)) ?? 'left';
      this.logos.update(list => [...list, { image, position }]);
    });
  }

  protected setPosition(i: number, position: string): void {
    this.logos.update(list => list.map((l, n) => (n === i ? { ...l, position: position as CertLogo['position'] } : l)));
    this.changed.emit();
  }

  protected remove(i: number): void {
    this.logos.update(list => list.filter((_, n) => n !== i));
    this.changed.emit();
  }
}
