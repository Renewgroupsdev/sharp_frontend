import { Component, Input, OnInit, computed, inject } from '@angular/core';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CommunityService } from '../../../shared/common-services/community.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { CountRibbon } from '../../../shared/components/count-ribbon/count-ribbon';
import { CommonFilterCard } from '../../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../../shared/components/common-table-card/common-table-card';
import { messageTime } from '../../../shared/components/group-chat/group-chat';
import { LocalListBase } from '../../../shared/components/local-list-base';
import { DetailCardData, QuickAction, TableColumn, TableRow } from '../../../shared/models/common-components.model';
import { CommunityGroup, GroupKind } from '../../../shared/models/community.model';
import { AddMembers } from '../add-members/add-members';
import { CommunityGroupForm } from '../community-group-form/community-group-form';
import { ChatDockService } from '../../../shared/common-services/chat-dock.service';

const TYPE_LABEL: Record<string, string> = { floor: 'Org-wide', course: 'Course', custom: 'Custom' };

/** The chat groups, or the announcement groups: one table, the same rows and actions for both kinds. */
@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [CountRibbon, CommonFilterCard, CommonTableCard],
  templateUrl: './group-list.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', '../community.scss'],
})
export class GroupList extends LocalListBase implements OnInit {
  private readonly store = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly dock = inject(ChatDockService);

  @Input({ required: true }) kind!: GroupKind;

  protected readonly noun = 'groups';
  protected override filterFields = { status: 'type', source: 'type', branch: ['title'] };

  override filters = [{ key: 'status', label: 'Type', options: Object.values(TYPE_LABEL) }];

  columns: TableColumn[] = [
    { key: 'group', header: 'Group name', type: 'lead', width: '24%' },
    { key: 'type', header: 'Type', type: 'badge', width: '9%' },
    { key: 'members', header: 'Members', width: '9%' },
    { key: 'messages', header: 'Messages', width: '9%' },
    { key: 'last', header: 'Last activity', width: '19%' },
    { key: 'by', header: 'Created by', width: '13%' },
    { key: 'actions', header: 'Actions', type: 'quickActions', width: '17%', sortable: false },
  ];

  override sortActive = 'order';
  override sortDirection: 'asc' | 'desc' = 'asc';

  /** Cards: how many groups of this kind, how many follow a course, how many are custom, and who is signed in now. */
  readonly stats = computed<DetailCardData[]>(() => {
    const groups = this.store.byKind(this.kind);
    const o = this.store.overview();
    const label = this.kind === 'Chat' ? 'Chat' : 'Announcement';
    return [
      { label: `${label} groups`, value: groups.length, icon: 'bi-chat-dots', iconVariant: 'blue' },
      { label: 'Course groups (auto)', value: groups.filter(g => g.source === 'course').length, icon: 'bi-journal-bookmark', iconVariant: 'green' },
      { label: 'Custom groups', value: groups.filter(g => g.source === 'custom').length, icon: 'bi-people', iconVariant: 'purple' },
      { label: `Online now (last ${o?.online_window_minutes ?? 5} min)`, value: o ? `${o.users_online} / ${o.users_total}` : '—', icon: 'bi-person-check', iconVariant: 'orange' },
    ];
  });

  ngOnInit(): void {
    this.refresh();
  }

  protected allRows(): TableRow[] {
    return this.store.byKind(this.kind).map(g => ({
      id: g.id,
      group: { name: g.title, subtitle: `#${g.id}` },
      __group: g.title,
      searchText: `${g.title} ${g.created_by ?? ''}`,
      title: g.title,
      type: TYPE_LABEL[g.source] ?? g.source,
      members: g.members_total,
      messages: g.messages_total,
      last: g.last_message ? `${messageTime(g.last_message.at)}${g.last_message.by ? ` · ${g.last_message.by}` : ''}` : '—',
      __last: g.last_message?.at ?? '',
      by: g.created_by ?? 'System',
      // Org-wide first, then course groups, then custom ones; by name within each.
      __order: `${g.source === 'floor' ? 0 : g.source === 'course' ? 1 : 2}${g.title.toLowerCase()}`,
      actions: this.actionsFor(g),
    }));
  }

  private actionsFor(g: CommunityGroup): QuickAction[] {
    const list: QuickAction[] = [{ key: 'view', icon: 'bi-eye', label: 'View', variant: 'primary', permission: 'a_comms.view' }];
    if (g.source === 'custom' || g.source === 'course') list.push({ key: 'add', icon: 'bi-person-plus', label: 'Add members', variant: 'primary', permission: 'a_comms.create' });
    if (g.source === 'custom') {
      list.push({ key: 'edit', icon: 'bi-pencil-square', label: 'Edit', variant: 'primary', permission: 'a_comms.edit' });
      list.push({ key: 'delete', icon: 'bi-trash3-fill', label: 'Delete', variant: 'danger', permission: 'a_comms.delete' });
    }
    return list;
  }

  /** The "Create" button of the page opens this. */
  create(): void {
    this.openDialog(CommunityGroupForm, { kind: this.kind }, '640px');
  }

  async onQuickAction(e: { row: TableRow; action: string }): Promise<void> {
    const group = this.store.group(Number(e.row['id']));
    if (!group) return;
    switch (e.action) {
      case 'view': this.dock.openChat(group.id); return;
      case 'edit': this.dock.openChat(group.id, 'edit'); return;
      case 'add': this.dock.openChat(group.id, 'add'); return;
      case 'delete': await this.remove(group); return;
    }
  }

  private async addMembers(group: CommunityGroup): Promise<void> {
    try {
      const { members } = await this.store.open(group.id);
      this.openDialog(AddMembers, { group, members }, '620px');
    } catch (err) {
      this.toast.error('Could not open the group', apiErrorMessage(err));
    }
  }

  private async remove(group: CommunityGroup): Promise<void> {
    if (!(await this.toast.confirm(`Delete “${group.title}”?`, 'Its messages are hidden for everyone. This cannot be undone.'))) return;
    try {
      await this.store.delete(group);
      this.toast.success('Group deleted');
    } catch (err) {
      this.toast.error('Could not delete the group', apiErrorMessage(err));
    }
  }
}
