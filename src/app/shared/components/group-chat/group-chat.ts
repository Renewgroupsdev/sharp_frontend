import { AfterViewChecked, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CommunityApi } from '../../common-services/community-api.service';
import { RealtimeService } from '../../common-services/realtime.service';
import { ToastService } from '../../common-services/toast.service';
import { CommunityMessage } from '../../models/community.model';

const MAX_LENGTH = 1000;

/** "12 Nov, 9:41 AM" for a message time. */
export const messageTime = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};

/**
 * Messages of one community group with a composer. It only needs a group id: the API decides whether the signed-in person
 * may read it (403 otherwise) and `canPost` / `canRemove` only shape the screen. New messages arrive live over the WebSocket
 * (RealtimeService); a slow refresh stays as the fallback for when the socket server is unreachable. Used in the staff group popup, and by any screen that shows one group's chat.
 */
@Component({
  selector: 'app-group-chat',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './group-chat.html',
  styleUrl: './group-chat.scss',
})
export class GroupChat implements AfterViewChecked {
  private readonly api = inject(CommunityApi);
  private readonly toast = inject(ToastService);
  private readonly realtime = inject(RealtimeService);
  private readonly userId = inject(AuthService).userId;

  readonly groupId = input.required<number>();
  /** Whether to show the composer. The API refuses a post the person may not make either way. */
  readonly canPost = input(true);
  /** Staff can take a message out of the conversation. */
  readonly canRemove = input(false);
  readonly announcement = input(false);
  /** WhatsApp-style bubbles (own messages on the right) that fill their container; used by the floating chat. */
  readonly bubbles = input(false);
  readonly placeholder = input('Write a message…');
  /** Why the composer is hidden, when it is. */
  readonly readOnlyNote = input('You can read this conversation but not write in it.');
  /** Fallback refresh when the socket is down; live messages do not wait for it. */
  readonly pollMs = input(30_000);

  protected readonly messages = signal<CommunityMessage[]>([]);
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly maxLength = MAX_LENGTH;
  protected readonly when = messageTime;
  protected readonly myId = this.userId;
  /** Time only, for a bubble. */
  protected readonly clock = (iso: string): string => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private seen = 0;
  /** The first message from someone else that was unread when the chat opened; the chat opens there. */
  protected readonly firstUnreadId = signal<number | null>(null);
  protected readonly unreadCount = signal(0);
  /** The messages this person pinned in this chat (only they see them), newest pin first; the bar at the top shows one at a time. */
  protected readonly pinned = signal<CommunityMessage[]>([]);
  protected readonly canPin = signal(false);
  protected readonly pinIndex = signal(0);
  protected readonly pinnedIds = computed(() => new Set(this.pinned().map(m => m.id)));
  protected readonly pinShown = computed(() => this.pinned()[Math.min(this.pinIndex(), this.pinned().length - 1)] ?? null);
  private positioned = false;
  private readTimer?: ReturnType<typeof setTimeout>;
  private loadedOnce = false;
  private lastMarked = 0;
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    effect(onCleanup => {
      const id = this.groupId();
      const ms = this.pollMs();
      this.messages.set([]);
      this.seen = 0;
      this.firstUnreadId.set(null);
      this.unreadCount.set(0);
      this.pinned.set([]);
      this.canPin.set(false);
      this.pinIndex.set(0);
      this.positioned = false;
      clearTimeout(this.readTimer);
      this.loadedOnce = false;
      this.lastMarked = 0;
      void this.refresh(id);
      const stop = this.realtime.listenGroup(id, {
        posted: m => { this.messages.update(list => (list.some(x => x.id === m.id) ? list : [...list, m])); this.markRead(id); },
        removed: mid => this.messages.update(list => list.filter(x => x.id !== mid)),
      });
      this.timer = setInterval(() => void this.refresh(id), ms);
      onCleanup(() => { clearInterval(this.timer); stop(); });
    });
    inject(DestroyRef).onDestroy(() => { clearInterval(this.timer); clearTimeout(this.readTimer); });
  }

  private async refresh(id: number): Promise<void> {
    try {
      const { messages: list, lastRead, pinned, canPin } = await this.api.messages(id);
      if (id === this.groupId()) {
        this.pinned.set(pinned);
        this.canPin.set(canPin);
        if (!this.loadedOnce) {
          // First load of this chat: remember where the unread messages begin, so the chat opens there.
          this.loadedOnce = true;
          const fresh = list.filter(m => m.id > lastRead && m.author?.user_id !== this.myId());
          this.firstUnreadId.set(fresh[0]?.id ?? null);
          this.unreadCount.set(fresh.length);
        }
        this.messages.set(list);
        this.error.set(null);
        this.markRead(id);
      }
    } catch (e) {
      if (id === this.groupId()) this.error.set(apiErrorMessage(e));
    }
  }

  protected async send(): Promise<void> {
    const body = this.draft().trim().slice(0, MAX_LENGTH);
    if (!body || this.sending()) return;
    this.sending.set(true);
    try {
      const sent = await this.api.postMessage(this.groupId(), body);
      this.messages.update(list => (list.some(x => x.id === sent.id) ? list : [...list, sent]));
      this.firstUnreadId.set(null); // answering means the person has read what came before
      this.unreadCount.set(0);
      this.draft.set('');
    } catch (e) {
      this.toast.error('Could not send', apiErrorMessage(e));
    } finally {
      this.sending.set(false);
    }
  }

  /** Pins a message, or unpins it when it is already pinned. */
  protected async togglePin(message: CommunityMessage): Promise<void> {
    const pin = !this.pinnedIds().has(message.id);
    try {
      this.pinned.set(await this.api.pinMessage(this.groupId(), message.id, pin));
      this.pinIndex.set(0);
    } catch (e) {
      this.toast.warning(pin ? 'Could not pin' : 'Could not unpin', apiErrorMessage(e));
    }
  }

  /** Click on the pinned bar: jump to that message, and the next click shows the next pinned one. */
  protected showPinned(): void {
    const m = this.pinShown();
    if (!m) return;
    const el = this.scroller()?.nativeElement.querySelector<HTMLElement>(`[data-mid="${m.id}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('gc-flash');
      setTimeout(() => el.classList.remove('gc-flash'), 1500);
    }
    this.pinIndex.update(i => (i + 1) % this.pinned().length);
  }

  protected async remove(message: CommunityMessage): Promise<void> {
    if (!(await this.toast.confirm('Remove this message?', 'It disappears from the conversation for everyone.', 'Yes, remove it'))) return;
    try {
      await this.api.removeMessage(this.groupId(), message.id);
      this.messages.update(list => list.filter(m => m.id !== message.id));
      this.pinned.update(list => list.filter(m => m.id !== message.id));
    } catch (e) {
      this.toast.error('Could not remove it', apiErrorMessage(e));
    }
  }

  /** Tells the server how far this person has read, so unread counts and the "first unread" spot stay right after a reload. */
  private markRead(id: number): void {
    const last = this.messages().at(-1)?.id ?? 0;
    if (!last || last <= this.lastMarked) return;
    this.lastMarked = last;
    void this.api.markRead(id, last).catch(() => { this.lastMarked = 0; });
  }

  /** Once the bottom of the chat is in view the unread messages have been read: the "unread" bar goes away. */
  protected checkRead(): void {
    const el = this.scroller()?.nativeElement;
    if (!el || this.firstUnreadId() === null) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) {
      clearTimeout(this.readTimer);
      this.readTimer = setTimeout(() => { this.firstUnreadId.set(null); this.unreadCount.set(0); }, 1500);
    }
  }

  ngAfterViewChecked(): void {
    const el = this.scroller()?.nativeElement;
    if (!el || this.messages().length === this.seen) return;
    this.seen = this.messages().length;
    const marker = el.querySelector<HTMLElement>('#gc-unread');
    if (!this.positioned && marker) {
      // Opening a chat with unread messages: start at the first one, not at the bottom.
      el.scrollTop = marker.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 8;
    } else {
      el.scrollTop = el.scrollHeight;
    }
    if (!this.positioned) setTimeout(() => this.checkRead(), 2500); // opened with everything on screen: it counts as read
    this.positioned = true;
  }
}
