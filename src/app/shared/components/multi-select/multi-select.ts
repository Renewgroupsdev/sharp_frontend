import { Component, ElementRef, HostListener, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Names compare without case or extra spaces, so "startup" and "Startup " are the same one. */
const key = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * A dropdown where several items can be ticked. An "Other…" row opens a small input: a new name is added to the list and
 * ticked, and a name the list already has (ignoring case) is just ticked, so every name appears once.
 * Two-way bind the ticked names with [(selected)]; the parent stores the new names so they are offered next time.
 */
@Component({
  selector: 'app-multi-select',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './multi-select.html',
  styleUrl: './multi-select.scss',
})
export class MultiSelect {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly options = input.required<string[]>();
  readonly selected = model<string[]>([]);
  readonly placeholder = input('Select');
  readonly inputId = input('');
  readonly maxLength = input(80);

  readonly open = signal(false);
  readonly adding = signal(false);
  readonly message = signal<string | null>(null);
  /** Names added through "Other" in this session; they join the options right away. */
  private readonly extra = signal<string[]>([]);
  /** What the user typed in the search box; it only filters the rows. */
  readonly query = signal('');
  other = '';

  /** The options, plus anything ticked or added that the list does not hold yet. */
  readonly list = computed(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const name of [...this.options(), ...this.extra(), ...this.selected()]) {
      const k = key(name);
      if (k && !seen.has(k)) { seen.add(k); out.push(name.trim()); }
    }
    return out;
  });

  /** The rows that match the search (names containing the typed text, ignoring case). */
  readonly shown = computed(() => {
    const q = key(this.query());
    return q ? this.list().filter(n => key(n).includes(q)) : this.list();
  });

  readonly summary = computed(() => {
    const s = this.selected();
    return s.length ? s.join(', ') : '';
  });

  isOn(name: string): boolean {
    return this.selected().some(s => key(s) === key(name));
  }

  toggle(name: string): void {
    this.selected.set(this.isOn(name) ? this.selected().filter(s => key(s) !== key(name)) : [...this.selected(), name]);
  }

  remove(name: string, event: Event): void {
    event.stopPropagation();
    this.selected.set(this.selected().filter(s => key(s) !== key(name)));
  }

  openOther(): void {
    this.adding.set(true);
    this.message.set(null);
  }

  /** Adds the typed name once: an existing one (any case) is only ticked. */
  addOther(): void {
    const name = this.other.replace(/,/g, ' ').trim().replace(/\s+/g, ' ');
    if (!name) return void this.message.set('Type a name first.');
    const existing = this.list().find(n => key(n) === key(name));
    if (existing) {
      if (!this.isOn(existing)) this.selected.set([...this.selected(), existing]);
      this.message.set(`“${existing}” is already in the list, so it was selected.`);
    } else {
      this.extra.set([...this.extra(), name]);
      this.selected.set([...this.selected(), name]);
      this.message.set(null);
    }
    this.other = '';
    if (!existing) this.adding.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) { this.open.set(false); this.query.set(''); }
  }

  @HostListener('keydown.escape')
  onEscape(): void { this.open.set(false); }

  toggleOpen(): void {
    this.open.set(!this.open());
    if (!this.open()) this.query.set('');
  }
}
