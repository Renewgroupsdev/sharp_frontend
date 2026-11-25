import { Component, HostListener, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DOCS, MODULES, STUDENT } from '../../../../core/data/programme-data';
import { StudentProgress } from '../../student-progress.service';

interface DocSection { h: string; p?: string[]; l?: string[]; }

/** View-only, watermarked viewer for a module material: video placeholder player or paged document. */
@Component({
  selector: 'app-material-viewer',
  standalone: true,
  templateUrl: './material-viewer.html',
  styleUrls: ['../../student.scss', './material-viewer.scss'],
})
export class MaterialViewer implements OnInit {
  private readonly progress = inject(StudentProgress);
  readonly moduleId = input.required<number>();
  readonly index = input.required<number>();
  readonly closed = output<void>();

  protected readonly student = STUDENT;
  protected readonly blanked = signal(false);
  protected readonly playing = signal(false);
  protected readonly mod = computed(() => MODULES.find(m => m.id === this.moduleId())!);
  protected readonly mat = computed(() => this.mod().mats[this.index()]);
  protected readonly sections = computed<DocSection[]>(() => (DOCS as Record<string, DocSection[]>)[this.mat().t] ?? [{ h: this.mat().t, p: ['Sample content.'] }]);
  protected readonly watermark = `SHARP · ${STUDENT.name} · ${STUDENT.id} · view only`;
  protected readonly marks = Array.from({ length: 12 }, (_, i) => i);

  ngOnInit(): void {
    this.progress.markOpened(this.moduleId(), this.index());
  }

  @HostListener('window:blur')
  protected onBlur(): void { this.blanked.set(true); }

  @HostListener('document:keyup', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'PrintScreen') this.blanked.set(true);
  }

  protected block(e: Event): void { e.preventDefault(); }
}
