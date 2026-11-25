import { Component, OnInit, inject, input } from '@angular/core';
import { ChatDockService, ChatScope } from '../../common-services/chat-dock.service';

/**
 * What the Common Floor and Group Discussion pages show: the chat itself lives in the right-hand drawer, so the page opens
 * it straight away and keeps a button to bring it back after it is closed.
 */
@Component({
  selector: 'app-chat-launcher',
  standalone: true,
  template: `
    <div class="cl">
      <i class="bi" [class]="icon()"></i>
      <p>{{ text() }}</p>
      <button type="button" (click)="open()"><i class="bi bi-chat-dots-fill"></i> {{ label() }}</button>
    </div>
  `,
  styles: `
    .cl { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 42px 16px; text-align: center; border: 1px dashed var(--border-soft, #d1d5db); border-radius: 14px; background: #fff; }
    .cl > i { font-size: 40px; color: var(--primary-dark, #0b5d49); }
    p { margin: 0; max-width: 460px; font-size: 13.5px; color: var(--text-muted, #6b7280); }
    button { height: 42px; padding: 0 22px; border: 0; border-radius: 10px; background: var(--primary-dark, #0b5d49); color: #fff; font-weight: 600; cursor: pointer; }
  `,
})
export class ChatLauncher implements OnInit {
  private readonly dock = inject(ChatDockService);

  readonly scope = input<ChatScope>('all');
  readonly icon = input('bi-people');
  readonly text = input('Your conversations open in the chat drawer on the right.');
  readonly label = input('Open chat');

  ngOnInit(): void { this.open(); }

  protected open(): void { this.dock.show(this.scope()); }
}
