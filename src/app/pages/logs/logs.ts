import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { AUDIT_HEAD, AuditEntry, AuditLogsApi, auditRow, auditWhen } from '../../shared/common-services/audit-logs-api.service';
import { toCsv } from '../../shared/utils/csv.util';
import { fileStamp, saveBlob } from '../../shared/utils/export.util';

/** Logs Management: the server's audit trail (sign-ins, creates, updates, reviews...), limited to what the signed-in role may see. */
@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './logs.html',
  styleUrls: ['../../shared/styles/erp-page.scss', './logs.scss'],
})
export class Logs implements OnInit {
  private readonly api = inject(AuditLogsApi);

  readonly entries = signal<AuditEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly search = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '');
  readonly role = signal('');

  readonly roles = computed(() => [...new Set(this.entries().map(e => e.actor_role).filter((r): r is string => !!r))].sort());
  readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const role = this.role();
    return this.entries().filter(e => (!role || e.actor_role === role) && (!q || [e.actor_name, e.action, e.target, e.details].some(x => (x ?? '').toLowerCase().includes(q))));
  });
  readonly shown = computed(() => this.rows().slice(0, 300));

  protected readonly when = auditWhen;

  async ngOnInit(): Promise<void> {
    try {
      this.entries.set(await this.api.list());
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  download(): void {
    const csv = toCsv(AUDIT_HEAD, this.rows().map(auditRow));
    saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `activity-log-${fileStamp()}.csv`);
  }
}
