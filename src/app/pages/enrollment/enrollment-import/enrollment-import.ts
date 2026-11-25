import { NgClass } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';
import { BatchEnrollmentsService } from '../../../shared/common-services/batch-enrollments.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { ImportResult } from '../../../shared/models/batch-enrollment.model';
import { parseCsv } from '../../../shared/utils/csv.util';
import { downloadCsv } from '../../../shared/utils/csv-download.util';

const MAX_ROWS = 1000;

/** Import enrollments from a CSV of `course,batch` rows: the server previews the outcome first, then you confirm. */
@Component({
  selector: 'app-enrollment-import',
  standalone: true,
  imports: [NgClass, MatDialogModule],
  templateUrl: './enrollment-import.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './enrollment-import.scss'],
})
export class EnrollmentImport {
  private readonly ref = inject(MatDialogRef<EnrollmentImport, boolean>);
  private readonly store = inject(BatchEnrollmentsService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);

  private rows: { course: string; batch: string }[] = [];
  readonly fileName = signal('');
  readonly preview = signal<ImportResult | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly canImport = computed(() => (this.preview()?.summary.ok ?? 0) > 0 && !this.busy());

  template(): void {
    downloadCsv('enrollment-import-template', ['course', 'batch'], [['Communication Skills', 'SHARP Batch 07'], ['CRS-002', 'SHARP Batch 08']]);
  }

  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.preview.set(null);
    this.error.set(null);
    if (!file) return;
    this.fileName.set(file.name);

    const table = parseCsv(await file.text());
    const hasHeader = table[0]?.some(c => /^course$/i.test(c.trim())) && table[0]?.some(c => /^batch$/i.test(c.trim()));
    const head = (hasHeader ? table[0] : ['course', 'batch']).map(c => c.trim().toLowerCase());
    const ci = head.indexOf('course'), bi = head.indexOf('batch');
    this.rows = table.slice(hasHeader ? 1 : 0).map(r => ({ course: (r[ci] ?? '').trim(), batch: (r[bi] ?? '').trim() }));

    if (!this.rows.length) return void this.error.set('The file has no rows. Use two columns: course, batch.');
    if (this.rows.length > MAX_ROWS) return void this.error.set(`Import at most ${MAX_ROWS} rows at a time (this file has ${this.rows.length}).`);

    this.busy.set(true);
    try {
      this.preview.set(await this.store.importRows(this.rows, true));
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async confirm(): Promise<void> {
    if (!this.canImport()) return;
    this.busy.set(true);
    try {
      const r = await this.store.importRows(this.rows, false);
      this.log.record('Enrollment', `Imported ${r.summary.ok} enrollment(s) from ${this.fileName()}`);
      this.toast.success('Import complete', `${r.summary.ok} enrolled, ${r.summary.exists} already enrolled, ${r.summary.error} skipped.`);
      this.ref.close(true);
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  /** The preview as a CSV, so the rows that failed can be fixed and re-imported. */
  exportPreview(): void {
    const p = this.preview();
    if (p) downloadCsv('enrollment-import-result', ['line', 'course', 'batch', 'result', 'message'], p.rows.map(r => [r.line, r.course, r.batch, r.status, r.message]));
  }

  close(): void { this.ref.close(false); }
}
