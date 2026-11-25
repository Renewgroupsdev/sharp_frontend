import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CommunityService } from '../../../shared/common-services/community.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { UsersService } from '../../../shared/common-services/users.service';
import { COMMUNITY_OVERSIGHT_ROLES, CommunityGroup, CommunityMember } from '../../../shared/models/community.model';
import { CommunityMemberPicker } from '../community-member-picker/community-member-picker';

export interface AddMembersData { group: CommunityGroup; members: CommunityMember[] }

/** Add more people to a custom or course group. People already in it are left out of the list. */
@Component({
  selector: 'app-add-members',
  standalone: true,
  imports: [MatDialogModule, CommunityMemberPicker],
  templateUrl: './add-members.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class AddMembers {
  private readonly ref = inject(MatDialogRef<AddMembers, boolean>);
  private readonly data = inject<AddMembersData>(MAT_DIALOG_DATA);
  private readonly store = inject(CommunityService);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);

  protected readonly group = this.data.group;
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly picked = signal<string[]>([]);

  protected readonly people = computed(() => {
    const inGroup = new Set(this.data.members.map(m => m.user_id));
    return this.users.items().filter(u => u.st !== 'Suspended' && !COMMUNITY_OVERSIGHT_ROLES.includes(u.r) && !inGroup.has(u.id));
  });

  protected async save(): Promise<void> {
    this.serverError.set(null);
    if (!this.picked().length) return this.toast.warning('Select at least one person to add');
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.addMembers(this.group.id, this.picked());
      this.toast.success(`${this.picked().length} member${this.picked().length === 1 ? '' : 's'} added`, this.group.title);
      this.ref.close(true);
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected close(): void {
    this.ref.close(false);
  }
}
