import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { NotificationRulesService } from '../../../shared/common-services/notification-rules.service';
import { ToastService } from '../../../shared/common-services/toast.service';

/** Edit the wording and on/off state of one notification rule. The event and its audience are fixed by the app. */
@Component({
  selector: 'app-notification-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './notification-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class NotificationForm {
  private readonly ref = inject(MatDialogRef<NotificationForm>);
  private readonly data = inject<{ event: string }>(MAT_DIALOG_DATA);
  private readonly store = inject(NotificationRulesService);
  private readonly toast = inject(ToastService);

  protected readonly rule = this.store.get(this.data.event)!;
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected title = this.rule.title;
  protected body = this.rule.body;
  protected enabled = this.rule.enabled;

  async save(f: NgForm): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (f.invalid || !this.title.trim() || !this.body.trim() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.update(this.rule.event, { title: this.title.trim(), body: this.body.trim(), enabled: this.enabled });
      this.toast.success('Notification rule updated', this.rule.label);
      this.ref.close(true);
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.ref.close();
  }
}
