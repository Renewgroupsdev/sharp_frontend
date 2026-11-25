import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { SharpUser } from '../../../core/data/models';
import { ToastService } from '../../common-services/toast.service';
import { UsersService } from '../../common-services/users.service';
import { ChatDockService } from '../../common-services/chat-dock.service';
import { CommunityService } from '../../common-services/community.service';
import { RealtimeService } from '../../common-services/realtime.service';
import { CommunityGroup, CommunityMember, groupLabel, presenceLabel } from '../../models/community.model';
import { ChatGroupManage } from './chat-group-manage';
import { GroupChat } from '../group-chat/group-chat';

interface Preview { body: string; at: string }
interface Notice { groupId: number; title: string; by: string; body: string; at: number }

export type ChatTab = 'all' | 'groups' | 'personal' | 'announce';
const categoryOf = (g: CommunityGroup): Exclude<ChatTab, 'all'> => (g.source === 'dm' ? 'personal' : g.kind === 'Announcement' ? 'announce' : 'groups');

/**
 * The floating chat at the bottom-right of every signed-in screen, laid out like WhatsApp: a round button with the unread
 * count, a panel with the person's chats (newest first) and, once one is opened, its conversation as bubbles.
 * Messages arrive live over the WebSocket; the chat list refreshes itself when someone starts a chat with you or adds you
 * to a group.
 */
@Component({
  selector: 'app-chat-dock',
  standalone: true,
  imports: [GroupChat, ChatGroupManage],
  templateUrl: './chat-dock.html',
  styleUrl: './chat-dock.scss',
})
export class ChatDock implements OnInit {
  private readonly store = inject(CommunityService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly users = inject(UsersService);
  private readonly dock = inject(ChatDockService);

  protected readonly open = signal(false);
  protected readonly activeId = signal<number | null>(null);
  /** Which kind of chat the list shows. */
  protected readonly filter = signal<ChatTab>('all');
  protected readonly tabs: { key: ChatTab; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'bi-chat-dots' },
    { key: 'groups', label: 'Groups', icon: 'bi-people' },
    { key: 'personal', label: 'Personal', icon: 'bi-person' },
    { key: 'announce', label: 'Announcements', icon: 'bi-megaphone' },
  ];
  /** The newest message of each chat with unread messages. */
  private readonly notices = signal<Record<number, Notice>>({});
  /** The card above the chat button: the newest unread message; it stays until that chat is read. */
  protected readonly notice = computed<(Notice & { count: number }) | null>(() => {
    const u = this.unread();
    const all = Object.values(this.notices()).filter(n => u[n.groupId]).sort((a, b) => b.at - a.at);
    return all[0] ? { ...all[0], count: u[all[0].groupId] ?? 1 } : null;
  });
  /** Add members / Edit of the open group, shown in the drawer. */
  protected readonly panel = signal<'add' | 'edit' | null>(null);
  protected readonly canAdd = computed(() => { const g = this.active(); return !!g && (g.source === 'custom' || g.source === 'course') && this.auth.can('a_comms', 'c'); });
  protected readonly canEdit = computed(() => { const g = this.active(); return !!g && g.source === 'custom' && this.auth.can('a_comms', 'u'); });
  protected readonly picking = signal(false);
  protected readonly starting = signal(false);
  protected readonly search = signal('');
  /** Everyone who can be messaged, filtered by the search box. */
  protected readonly people = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.users.items()
      .filter(u => u.st !== 'Suspended' && u.id !== this.myId() && (!q || u.n.toLowerCase().includes(q) || u.r.toLowerCase().includes(q)))
      .sort((a, b) => a.n.localeCompare(b.n))
      .slice(0, 100);
  });
  protected readonly tab = signal<'chat' | 'members'>('chat');
  protected readonly members = signal<CommunityMember[]>([]);
  protected readonly membersLoading = signal(false);
  protected readonly unread = signal<Record<number, number>>({});
  private readonly previews = signal<Record<number, Preview>>({});

  protected readonly myId = this.auth.userId;
  protected readonly totalUnread = computed(() => Object.values(this.unread()).reduce((a, b) => a + b, 0));

  /** Every chat the person can open, most recent first. */
  protected readonly chats = computed<CommunityGroup[]>(() => {
    const pv = this.previews();
    const at = (g: CommunityGroup) => pv[g.id]?.at ?? g.last_message?.at ?? g.created_at;
    // Pinned chats stay on top in the order they were pinned; the rest follow, newest message first.
    return [...this.store.groups(), ...this.store.dms()].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.pinned && b.pinned) return (a.pinned_at ?? '').localeCompare(b.pinned_at ?? '');
      return at(b).localeCompare(at(a));
    });
  });

  protected readonly pinnedCount = computed(() => this.chats().filter(g => g.pinned).length);

  protected readonly shown = computed<CommunityGroup[]>(() => this.chats().filter(g => this.filter() === 'all' || categoryOf(g) === this.filter()));

  /** Unread messages per tab, for the little badges on the tabs. */
  protected readonly tabUnread = computed<Record<ChatTab, number>>(() => {
    const out: Record<ChatTab, number> = { all: 0, groups: 0, personal: 0, announce: 0 };
    const u = this.unread();
    for (const g of this.chats()) { const n = u[g.id] ?? 0; out[categoryOf(g)] += n; out.all += n; }
    return out;
  });

  protected readonly active = computed(() => this.chats().find(g => g.id === this.activeId()) ?? null);

  constructor() {
    // A page asked for the drawer: on the list, or straight into one chat (the View icon in SHARP Community).
    effect(() => {
      const req = this.dock.request();
      if (!req) return;
      untracked(() => {
        this.picking.set(false);
        this.activeId.set(null);
        this.filter.set(req.scope === 'groups' ? 'groups' : 'all');
        this.open.set(true);
      });
    });
    effect(() => {
      const req = this.dock.chat();
      if (!req) return;
      untracked(() => {
        this.open.set(true);
        this.pick({ id: req.id } as CommunityGroup);
        this.panel.set(req.panel ?? null);
        if (!this.chats().some(g => g.id === req.id)) void this.reload();
      });
    });
    // One live subscription per chat while the list stays the same; the unread count grows for chats that are not on screen.
    effect(onCleanup => {
      const stops = this.chats().map(g => this.realtime.listenGroup(g.id, { posted: m => this.onMessage(g, m.body, m.at, m.author) }));
      onCleanup(() => stops.forEach(stop => stop()));
    });
    effect(onCleanup => {
      const stop = this.realtime.listenChats(this.myId(), () => void this.reload());
      onCleanup(stop);
    });
  }

  ngOnInit(): void {
    void this.reload();
  }

  private async reload(): Promise<void> {
    try {
      await Promise.all([this.store.load(), this.store.loadDms()]);
      // The server keeps what has been read, so the counts survive a reload; the chat on screen counts as read.
      const counts: Record<number, number> = {};
      for (const g of [...this.store.groups(), ...this.store.dms()]) {
        if (g.unread > 0 && !(this.open() && this.activeId() === g.id)) counts[g.id] = g.unread;
      }
      this.unread.set(counts);
    } catch { /* the dock stays empty; the pages show their own errors */ }
  }

  /** Pins or unpins a chat for this person (like Telegram: pinned chats stay at the top of the list). */
  protected async togglePin(g: CommunityGroup, event?: Event): Promise<void> {
    event?.stopPropagation();
    try {
      await this.store.pin(g, !g.pinned);
    } catch (e) {
      this.toast.warning(g.pinned ? 'Could not unpin' : 'Could not pin', apiErrorMessage(e));
    }
  }

  private onMessage(g: CommunityGroup, body: string, at: string, author: { user_id: string; name: string } | null): void {
    this.previews.update(p => ({ ...p, [g.id]: { body, at } }));
    const looking = this.open() && this.activeId() === g.id;
    if (looking || author?.user_id === this.myId()) return;
    this.unread.update(u => ({ ...u, [g.id]: (u[g.id] ?? 0) + 1 }));
    this.notices.update(n => ({ ...n, [g.id]: { groupId: g.id, title: this.label(g), by: author?.name ?? 'Someone', body, at: Date.now() } }));
  }

  protected openNotice(n: Notice): void {
    this.dock.openChat(n.groupId);
  }

  protected readonly presence = presenceLabel;

  protected label(g: CommunityGroup): string { return groupLabel(g, this.myId()); }

  protected preview(g: CommunityGroup): string {
    const p = this.previews()[g.id];
    if (p) return p.body;
    return g.source === 'dm' ? 'Personal chat' : g.kind === 'Announcement' ? 'Announcements' : `${g.members_total} members`;
  }

  protected initials(g: CommunityGroup): string {
    return this.label(g).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  }

  protected toggle(): void {
    this.open.update(v => !v);
    if (this.open() && this.activeId()) this.clear(this.activeId()!);
  }

  protected pick(g: CommunityGroup): void {
    this.picking.set(false);
    this.panel.set(null);
    this.activeId.set(g.id);
    this.tab.set('chat');
    this.members.set([]);
    this.clear(g.id);
  }

  protected async showMembers(): Promise<void> {
    const id = this.activeId();
    this.tab.set('members');
    if (id === null || this.members().length) return;
    this.membersLoading.set(true);
    try {
      const res = await this.store.open(id);
      if (this.activeId() === id) this.members.set(res.members);
    } catch { /* the list stays empty */ } finally {
      this.membersLoading.set(false);
    }
  }

  protected subtitle(g: CommunityGroup): string {
    return g.source === 'dm' ? 'Personal chat' : `${g.kind === 'Announcement' ? 'Announcements' : 'Group chat'} · ${g.members_total} members`;
  }

  protected back(): void { this.picking.set(false); this.panel.set(null); this.activeId.set(null); }

  /** After Add members / Edit saved: back to the chat, with the member list reloaded. */
  protected panelDone(): void { this.panel.set(null); this.members.set([]); if (this.tab() === 'members') void this.showMembers(); }

  private clear(id: number): void {
    this.unread.update(u => {
      if (!u[id]) return u;
      const { [id]: _, ...rest } = u;
      return rest;
    });
  }

  /** Opens the in-drawer picker for a new personal chat. */
  protected newMessage(): void {
    this.search.set('');
    this.picking.set(true);
  }

  protected async startWith(p: SharpUser): Promise<void> {
    if (this.starting()) return;
    this.starting.set(true);
    try {
      const chat = await this.store.openDm(p.id);
      this.picking.set(false);
      this.pick(chat);
    } catch (e) {
      this.toast.error('Could not start the chat', apiErrorMessage(e));
    } finally {
      this.starting.set(false);
    }
  }
}
