import { Component, OnInit, inject } from '@angular/core';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CommunityService } from '../../../shared/common-services/community.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { CommonFilterCard } from '../../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../../shared/components/common-table-card/common-table-card';
import { messageTime } from '../../../shared/components/group-chat/group-chat';
import { LocalListBase } from '../../../shared/components/local-list-base';
import { TableColumn, TableRow } from '../../../shared/models/common-components.model';
import { CommunityGroup } from '../../../shared/models/community.model';
import { ChatDockService } from '../../../shared/common-services/chat-dock.service';
import { NewMessage } from '../new-message/new-message';

/** One-to-one conversations. Staff review all of them (read-only); the people in a chat also write in it. */
@Component({
  selector: 'app-dm-list',
  standalone: true,
  imports: [CommonFilterCard, CommonTableCard],
  templateUrl: './dm-list.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', '../community.scss'],
})
export class DmList extends LocalListBase implements OnInit {
  private readonly store = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly dock = inject(ChatDockService);

  protected readonly noun = 'conversations';
  protected override filterFields = { status: 'title', source: 'title', branch: ['title'] };

  columns: TableColumn[] = [
    { key: 'conversation', header: 'Conversation', type: 'lead', width: '30%' },
    { key: 'by', header: 'Started by', width: '15%' },
    { key: 'messages', header: 'Messages', width: '10%' },
    { key: 'last', header: 'Last message', width: '25%' },
    { key: 'actions', header: 'Actions', type: 'quickActions', width: '12%', sortable: false },
  ];

  override sortActive = 'order';
  override sortDirection: 'asc' | 'desc' = 'desc';

  ngOnInit(): void {
    this.store.loadDms().catch(e => this.toast.error('Could not load personal chats', apiErrorMessage(e)));
  }

  protected allRows(): TableRow[] {
    return this.store.dms().map((g: CommunityGroup) => ({
      id: g.id,
      conversation: { name: g.title, subtitle: (g.participants ?? []).map(p => p.user_id).join(' ↔ ') },
      __conversation: g.title,
      searchText: g.title,
      title: g.title,
      by: g.created_by ?? '—',
      messages: g.messages_total,
      last: g.last_message ? `${messageTime(g.last_message.at)}${g.last_message.by ? ` · ${g.last_message.by}` : ''}` : 'No messages yet',
      __last: g.last_message?.at ?? '',
      __order: g.last_message?.at ?? g.created_at,
      actions: [
        { key: 'view', icon: 'bi-eye', label: 'View', variant: 'primary' as const, permission: 'a_comms.view' },
        { key: 'delete', icon: 'bi-trash3-fill', label: 'Delete', variant: 'danger' as const, permission: 'a_comms.delete' },
      ],
    }));
  }

  /** The "New personal message" button of the page opens this. */
  compose(): void {
    this.openDialog(NewMessage, {}, '560px').afterClosed().subscribe(chat => {
      if (chat) this.dock.openChat((chat as CommunityGroup).id);
    });
  }

  async onQuickAction(e: { row: TableRow; action: string }): Promise<void> {
    const group = this.store.group(Number(e.row['id']));
    if (!group) return;
    if (e.action === 'view') {
      this.dock.openChat(group.id);
    } else if (e.action === 'delete') {
      if (!(await this.toast.confirm(`Delete the conversation ${group.title}?`, 'Both people lose it. This cannot be undone.'))) return;
      try {
        await this.store.delete(group);
        this.toast.success('Conversation deleted');
      } catch (err) {
        this.toast.error('Could not delete it', apiErrorMessage(err));
      }
    }
  }
}
