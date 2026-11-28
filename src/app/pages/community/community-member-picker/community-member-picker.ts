import { Component, computed, input, model, signal } from '@angular/core';
import { SharpUser } from '../../../core/data/models';

/** Searchable checklist of people with "+ All <role>s" shortcuts; two-way binds the selected user ids. */
@Component({
  selector: 'app-community-member-picker',
  standalone: true,
  templateUrl: './community-member-picker.html',
  styleUrls: ['./community-member-picker.scss'],
})
export class CommunityMemberPicker {
  readonly users = input.required<SharpUser[]>();
  readonly selected = model<string[]>([]);
  readonly query = signal('');

  readonly role = signal('');
  readonly org = signal('');
  readonly batch = signal('');

  private readonly uniq = (xs: (string | undefined | null)[]): string[] => [...new Set(xs.filter((x): x is string => !!x))].sort();
  readonly roles = computed(() => this.uniq(this.users().map(u => u.r)));
  readonly orgs = computed(() => this.uniq(this.users().map(u => u.org)));
  readonly batches = computed(() => this.uniq(this.users().map(u => u.b)));

  readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    const role = this.role(), org = this.org(), batch = this.batch();
    return this.users().filter(u => (!role || u.r === role) && (!org || u.org === org) && (!batch || u.b === batch)
      && (!q || `${u.n} ${u.r} ${u.id} ${u.org ?? ''}`.toLowerCase().includes(q)));
  });

  toggle(id: string): void {
    this.selected.update(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]));
  }

  /** Adds everyone the filters currently show. */
  addShown(): void {
    const ids = this.shown().map(u => u.id);
    this.selected.update(list => [...new Set([...list, ...ids])]);
  }

  clear(): void {
    this.selected.set([]);
  }
}
