import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ActivityLogService } from '../../shared/common-services/activity-log.service';
import { ToastService } from '../../shared/common-services/toast.service';
import { CanActionDirective } from '../../shared/directives/can-action.directive';
import { toCsv } from '../../shared/utils/csv.util';
import { fileStamp, saveBlob } from '../../shared/utils/export.util';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [FormsModule, CanActionDirective],
  templateUrl: './logs.html',
  styleUrls: ['../../shared/styles/erp-page.scss', './logs.scss'],
})
export class Logs {
  private readonly logs = inject(ActivityLogService);
  private readonly toast = inject(ToastService);

  readonly search = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '');
  readonly module = signal('');

  readonly modules = computed(() => [...new Set(this.logs.items().map(l => l.m))].sort());
  readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const m = this.module();
    return this.logs.items().filter(l => (!m || l.m === m) && (!q || [l.a, l.t, l.m].some(x => x.toLowerCase().includes(q))));
  });
  readonly shown = computed(() => this.rows().slice(0, 200));

  download(): void {
    const csv = toCsv(['When', 'Actor', 'Module', 'Activity'], this.rows().map(l => [l.w, l.a, l.m, l.t]));
    saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `activity-log-${fileStamp()}.csv`);
  }

  async clear(): Promise<void> {
    if (!(await this.toast.confirm('Clear the log?', 'All recorded activity will be removed.', 'Yes, clear it'))) return;
    this.logs.replace([]);
    this.logs.record('Logs Management', 'Cleared the activity log');
  }
}
