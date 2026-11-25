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

  readonly roles = computed(() => [...new Set(this.users().map(u => u.r))]);

  readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.users().filter(u => `${u.n} ${u.r} ${u.id} ${u.org ?? ''}`.toLowerCase().includes(q)) : this.users();
  });

  toggle(id: string): void {
    this.selected.update(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]));
  }

  addRole(role: string): void {
    const ids = this.users().filter(u => u.r === role).map(u => u.id);
    this.selected.update(list => [...new Set([...list, ...ids])]);
  }

  clear(): void {
    this.selected.set([]);
  }
}
