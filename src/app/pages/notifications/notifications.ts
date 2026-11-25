import { Component, OnInit, computed, inject } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { NotificationRulesService } from '../../shared/common-services/notification-rules.service';
import { ToastService } from '../../shared/common-services/toast.service';
import { CountRibbon } from '../../shared/components/count-ribbon/count-ribbon';
import { CommonFilterCard } from '../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../shared/components/common-table-card/common-table-card';
import { LocalListBase } from '../../shared/components/local-list-base';
import { CanActionDirective } from '../../shared/directives/can-action.directive';
import { RibbonItem, ExportFormat, TableColumn, TableRow } from '../../shared/models/common-components.model';
import { NotificationRule } from '../../shared/models/notification.model';
import { NotificationForm } from './notification-form/notification-form';
import { SendMessage } from './send-message/send-message';

/**
 * Notification Management: the automatic notifications (which event, who gets it, the wording, on or off) and messages
 * staff write by hand. Both reach people's bell the moment they are sent.
 */
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [MatDialogModule, CountRibbon, CommonFilterCard, CommonTableCard, CanActionDirective],
  templateUrl: './notifications.html',
  styleUrls: ['../../shared/styles/erp-page.scss'],
})
export class Notifications extends LocalListBase implements OnInit {
  private readonly store = inject(NotificationRulesService);
  private readonly toast = inject(ToastService);

  protected readonly noun = 'rules';
  protected override filterFields = { status: 'on', source: 'audience', branch: ['event'] };

  override filters = [{ key: 'status', label: 'State', options: ['Enabled', 'Disabled'] }];

  columns: TableColumn[] = [
    { key: 'event', header: 'Event', width: '20%' },
    { key: 'audience', header: 'Audience', width: '12%' },
    { key: 'channel', header: 'Channel', width: '9%' },
    { key: 'tpl', header: 'Message', width: '40%' },
    { key: 'on', header: 'State', type: 'badge', width: '9%' },
    { key: 'actions', header: 'Actions', type: 'quickActions', width: '10%', sortable: false },
  ];

  override sortActive = 'event';
  override sortDirection: 'asc' | 'desc' = 'asc';

  readonly stats = computed<RibbonItem[]>(() => {
    const r = this.store.rules();
    return [
      { label: 'Automatic rules', value: r.length, icon: 'bi-bell', iconVariant: 'blue' },
      { label: 'Enabled', value: r.filter(x => x.enabled).length, icon: 'bi-check-circle-fill', iconVariant: 'green', filter: { key: 'status', value: 'Enabled' } },
      { label: 'Disabled', value: r.filter(x => !x.enabled).length, icon: 'bi-slash-circle', iconVariant: 'orange', filter: { key: 'status', value: 'Disabled' } },
      { label: 'Customised wording', value: r.filter(x => this.customised(x)).length, icon: 'bi-pencil-square', iconVariant: 'purple' },
    ];
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.store.load();
    } catch (e) {
      this.toast.error('Could not load the rules', apiErrorMessage(e));
    }
  }

  protected allRows(): TableRow[] {
    return this.store.rules().map(r => ({
      id: r.event,
      event: r.label,
      audience: r.audience,
      channel: r.channel,
      tpl: `${r.title} — ${r.body}`,
      on: r.enabled ? 'Enabled' : 'Disabled',
      actions: [
        { key: 'toggle', icon: r.enabled ? 'bi-toggle-on' : 'bi-toggle-off', label: r.enabled ? 'Disable rule' : 'Enable rule', permission: 'a_notif.edit' },
        { key: 'edit', icon: 'bi-pencil-square', label: 'Edit wording', variant: 'primary', permission: 'a_notif.edit' },
        ...(this.customised(r) ? [{ key: 'reset', icon: 'bi-arrow-counterclockwise', label: 'Reset to default wording', permission: 'a_notif.edit' }] : []),
      ],
    }));
  }

  /** Opens the "send a message" form. */
  send(): void {
    this.openDialog(SendMessage, {}, '640px');
  }

  async onQuickAction(e: { row: TableRow; action: string }): Promise<void> {
    const rule = this.store.get(String(e.row['id']));
    if (!rule) return;
    try {
      if (e.action === 'edit') this.openDialog(NotificationForm, { event: rule.event }, '640px');
      else if (e.action === 'toggle') {
        await this.store.update(rule.event, { enabled: !rule.enabled });
        this.toast.success(rule.enabled ? 'Rule disabled' : 'Rule enabled', rule.label);
      } else if (e.action === 'reset') {
        if (!(await this.toast.confirm('Reset to the default wording?', `“${rule.label}” goes back to the wording the app ships with.`, 'Yes, reset it'))) return;
        await this.store.reset(rule.event);
        this.toast.success('Wording reset', rule.label);
      }
    } catch (err) {
      this.toast.error('Could not save the change', apiErrorMessage(err));
    }
  }

  onExport(format: ExportFormat): void {
    this.exportAs(format, 'notification-rules', 'Notification rules');
  }

  private customised(r: NotificationRule): boolean {
    return r.title !== r.default_title || r.body !== r.default_body;
  }
}
