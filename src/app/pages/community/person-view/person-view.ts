import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CommunityApi } from '../../../shared/common-services/community-api.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { UsersService } from '../../../shared/common-services/users.service';
import { messageTime } from '../../../shared/components/group-chat/group-chat';
import { CommunityGroup, CommunityMessage, CommunityPerson } from '../../../shared/models/community.model';
import { ChatDockService } from '../../../shared/common-services/chat-dock.service';

/** Staff review one person: the groups they are in and everything they have written, across every group. */
@Component({
  selector: 'app-person-view',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './person-view.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', './person-view.scss'],
})
export class PersonView {
  private readonly api = inject(CommunityApi);
  private readonly users = inject(UsersService);
  private readonly dock = inject(ChatDockService);
  private readonly toast = inject(ToastService);

  protected readonly when = messageTime;
  protected readonly people = computed(() => [...this.users.items()].sort((a, b) => a.n.localeCompare(b.n)));
  protected readonly person = signal<CommunityPerson | null>(null);
  protected readonly groups = signal<Pick<CommunityGroup, 'id' | 'name' | 'kind' | 'source'>[]>([]);
  protected readonly messages = signal<CommunityMessage[]>([]);
  protected readonly loading = signal(false);

  protected selected = '';

  protected async pick(userId: string): Promise<void> {
    this.selected = userId;
    if (!userId) return void this.person.set(null);
    this.loading.set(true);
    try {
      const res = await this.api.person(userId);
      this.person.set(res.person);
      this.groups.set(res.groups);
      this.messages.set(res.messages);
    } catch (e) {
      this.toast.error('Could not load this person', apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected openGroup(id: number): void {
    this.dock.openChat(id);
  }
}
