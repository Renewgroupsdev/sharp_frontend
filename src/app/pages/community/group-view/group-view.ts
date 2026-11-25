import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CommunityService } from '../../../shared/common-services/community.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { GroupChat } from '../../../shared/components/group-chat/group-chat';
import { COMMUNITY_OVERSIGHT_ROLES, CommunityGroup, CommunityMember, presenceLabel } from '../../../shared/models/community.model';
import { AddMembers } from '../add-members/add-members';

/**
 * One group in a popup: who is in it, add or remove people, and the conversation. Staff see every group, personal chats
 * included (read-only unless they are one of the two people).
 */
@Component({
  selector: 'app-group-view',
  standalone: true,
  imports: [MatDialogModule, GroupChat],
  templateUrl: './group-view.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './group-view.scss'],
})
export class GroupView implements OnInit {
  private readonly ref = inject(MatDialogRef<GroupView>);
  private readonly dialog = inject(MatDialog);
  private readonly store = inject(CommunityService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly data = inject<{ id: number }>(MAT_DIALOG_DATA);

  protected readonly group = signal<CommunityGroup | null>(null);
  protected readonly members = signal<CommunityMember[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly showMembers = signal(false);

  protected readonly isStaff = computed(() => COMMUNITY_OVERSIGHT_ROLES.includes(this.auth.role() ?? ''));
  protected readonly canManage = computed(() => this.isStaff() || this.group()?.created_by === this.auth.actor().n);
  protected readonly presence = presenceLabel;
  protected readonly online = computed(() => this.members().filter(m => m.online).length);
  protected readonly kindLabel = computed(() => {
    const g = this.group();
    return !g ? '' : g.source === 'dm' ? 'Personal conversation' : g.kind === 'Announcement' ? 'Announcement group' : 'Chat group';
  });
  protected readonly sourceNote = computed(() => {
    switch (this.group()?.source) {
      case 'floor': return 'Everyone in the organization is a member of this group.';
      case 'course': return 'Enrolled students, the batch mentors, Admin, Super Admin and OB are members automatically.';
      case 'dm': return 'A personal conversation between two people. Members cannot be added.';
      default: return 'Admin, Super Admin and OB are members automatically.';
    }
  });

  async ngOnInit(): Promise<void> {
    await this.load(this.data.id);
  }

  private async load(id: number): Promise<void> {
    try {
      const { group, members } = await this.store.open(id);
      this.group.set(group);
      this.members.set(members);
      this.error.set(null);
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    }
  }

  protected canAdd(): boolean {
    const g = this.group();
    return !!g && this.canManage() && (g.source === 'custom' || g.source === 'course');
  }

  protected addMembers(): void {
    const group = this.group();
    if (!group) return;
    this.dialog.open(AddMembers, { data: { group, members: this.members() }, width: '620px', maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', autoFocus: false })
      .afterClosed().subscribe(async added => {
        if (added) {
          this.showMembers.set(true);
          await this.load(group.id);
        }
      });
  }

  protected async remove(member: CommunityMember): Promise<void> {
    const group = this.group();
    if (!group || !(await this.toast.confirm(`Remove ${member.name}?`, `They leave “${group.title}”.`, 'Yes, remove'))) return;
    try {
      const res = await this.store.removeMember(group.id, member);
      this.group.set(res.group);
      this.members.set(res.members);
    } catch (e) {
      this.toast.error('Could not remove them', apiErrorMessage(e));
    }
  }

  /** Opens the personal chat with a member, in this same popup. */
  protected async message(member: CommunityMember): Promise<void> {
    try {
      const dm = await this.store.openDm(member.user_id);
      await this.load(dm.id);
    } catch (e) {
      this.toast.error('Could not open the chat', apiErrorMessage(e));
    }
  }

  protected close(): void {
    this.ref.close();
  }
}
