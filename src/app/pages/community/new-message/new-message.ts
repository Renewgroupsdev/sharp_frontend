import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CommunityApi } from '../../../shared/common-services/community-api.service';
import { CommunityService } from '../../../shared/common-services/community.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { UsersService } from '../../../shared/common-services/users.service';
import { CommunityGroup } from '../../../shared/models/community.model';

/** Start a personal message to anyone. Only you and the person take part; staff can review it. */
@Component({
  selector: 'app-new-message',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './new-message.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class NewMessage {
  private readonly ref = inject(MatDialogRef<NewMessage, CommunityGroup>);
  private readonly api = inject(CommunityApi);
  private readonly store = inject(CommunityService);
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly actorName = this.auth.actor().n;
  protected readonly people = computed(() => this.users.items()
    .filter(u => u.st !== 'Suspended' && u.id !== this.auth.actor().id)
    .sort((a, b) => a.r.localeCompare(b.r) || a.n.localeCompare(b.n)));
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected to = '';
  protected text = '';

  protected async send(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (!this.to || !this.text.trim() || this.saving()) return;
    this.saving.set(true);
    try {
      const chat = await this.store.openDm(this.to);
      await this.api.postMessage(chat.id, this.text.trim());
      void this.store.loadDms().catch(() => undefined);
      this.toast.success('Message sent');
      this.ref.close(chat);
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
