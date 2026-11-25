import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CommunityService } from '../../../shared/common-services/community.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { UsersService } from '../../../shared/common-services/users.service';
import { COMMUNITY_OVERSIGHT_ROLES, CommunityGroup, GroupKind } from '../../../shared/models/community.model';
import { CommunityMemberPicker } from '../community-member-picker/community-member-picker';

export interface GroupFormData {
  kind: GroupKind;
  /** Set to edit a custom group's name and members. */
  group?: CommunityGroup;
}

/** Create a chat or announcement group with the people you pick, or edit a custom group. Staff are added automatically. */
@Component({
  selector: 'app-community-group-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule, CommunityMemberPicker],
  templateUrl: './community-group-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class CommunityGroupForm implements OnInit {
  private readonly ref = inject(MatDialogRef<CommunityGroupForm, CommunityGroup>);
  private readonly data = inject<GroupFormData>(MAT_DIALOG_DATA);
  private readonly store = inject(CommunityService);
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly existing = this.data.group;
  protected readonly kind: GroupKind = this.existing?.kind ?? this.data.kind;
  protected readonly isEdit = !!this.existing;
  protected readonly createdBy = `${this.auth.actor().n} · ${this.auth.role() ?? ''}`;
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly loading = signal(this.isEdit);
  protected readonly serverError = signal<string | null>(null);

  protected name = this.existing?.name ?? '';
  /** Staff join every group on their own, so they are not offered. */
  protected readonly people = computed(() => this.users.items().filter(u => u.st !== 'Suspended' && !COMMUNITY_OVERSIGHT_ROLES.includes(u.r)));
  protected readonly picked = signal<string[]>([]);

  async ngOnInit(): Promise<void> {
    if (!this.existing) return;
    try {
      const { members } = await this.store.open(this.existing.id);
      const offered = new Set(this.people().map(u => u.id));
      this.picked.set(members.filter(m => m.removable && offered.has(m.user_id)).map(m => m.user_id));
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    const name = this.name.trim();
    if (!name) return;
    if (!this.picked().length) return this.toast.warning('Select at least one member');
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const res = this.existing
        ? await this.store.update(this.existing.id, { name, members: this.picked() })
        : await this.store.create({ name, kind: this.kind, members: this.picked() });
      this.toast.success(this.isEdit ? 'Group updated' : 'Group created', res.group.title);
      this.ref.close(res.group);
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected close(): void {
    this.ref.close();
  }
}
