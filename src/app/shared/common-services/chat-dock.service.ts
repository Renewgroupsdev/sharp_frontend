import { Injectable, signal } from '@angular/core';

export type ChatScope = 'all' | 'groups';

/** Lets any screen open the floating chat drawer: on the whole list, or straight into one chat. */
@Injectable({ providedIn: 'root' })
export class ChatDockService {
  /** `n` changes on every call, so asking for the same thing twice still re-opens the drawer. */
  readonly request = signal<{ scope: ChatScope; n: number } | null>(null);
  readonly chat = signal<{ id: number; n: number; panel?: 'add' | 'edit' } | null>(null);
  private n = 0;

  show(scope: ChatScope = 'all'): void {
    this.request.set({ scope, n: ++this.n });
  }

  /** Opens the drawer on one particular chat (a group, announcement or personal chat), optionally on its Add members / Edit panel. */
  openChat(id: number, panel?: 'add' | 'edit'): void {
    this.chat.set({ id, n: ++this.n, panel });
  }
}
