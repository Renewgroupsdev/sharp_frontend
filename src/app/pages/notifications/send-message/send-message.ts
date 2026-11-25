import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { BatchesService } from '../../../shared/common-services/batches.service';
import { NotificationRulesService } from '../../../shared/common-services/notification-rules.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { UsersService } from '../../../shared/common-services/users.service';
import { NOTIFICATION_ROLES } from '../../../shared/models/notification.model';
import { CommunityMemberPicker } from '../../community/community-member-picker/community-member-picker';

/** Write a notification by hand: pick roles (optionally one batch) and/or people, add the text, and it lands in their bell at once. */
@Component({
  selector: 'app-send-message',
  standalone: true,
  imports: [FormsModule, MatDialogModule, CommunityMemberPicker],
  templateUrl: './send-message.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './send-message.scss'],
})
export class SendMessage implements OnInit {
  private readonly ref = inject(MatDialogRef<SendMessage>);
  private readonly store = inject(NotificationRulesService);
  private readonly batches = inject(BatchesService);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);

  protected readonly roles = NOTIFICATION_ROLES;
  protected readonly batchList = computed(() => this.batches.items());
  protected readonly people = computed(() => this.users.items().filter(u => u.st !== 'Suspended'));
  protected readonly picked = signal<string[]>([]);
  protected readonly chosenRoles = signal<string[]>([]);
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected batchId = '';
  protected title = '';
  protected body = '';

  ngOnInit(): void {
    void this.batches.loadBatches().catch(() => undefined);
  }

  protected toggleRole(value: string): void {
    this.chosenRoles.update(list => (list.includes(value) ? list.filter(r => r !== value) : [...list, value]));
  }

  protected get hasAudience(): boolean {
    return this.chosenRoles().length > 0 || this.picked().length > 0;
  }

  protected async send(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (!this.title.trim() || !this.hasAudience || this.saving()) return;
    this.saving.set(true);
    try {
      const sent = await this.store.send({
        roles: this.chosenRoles(), batch_id: this.batchId ? Number(this.batchId) : null,
        users: this.picked(), title: this.title.trim(), body: this.body.trim(),
      });
      this.toast.success(sent === 1 ? 'Sent to 1 person' : `Sent to ${sent} people`, this.title.trim());
      this.ref.close(true);
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
