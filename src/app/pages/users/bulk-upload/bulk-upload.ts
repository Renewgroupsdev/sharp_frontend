import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ToastService } from '../../../shared/common-services/toast.service';
import { UsersService } from '../../../shared/common-services/users.service';
import { UserImportRow } from '../../../shared/models/user.model';
import { toCsv } from '../../../shared/utils/csv.util';
import { saveBlob } from '../../../shared/utils/export.util';

/** Bulk upload users from a CSV: preview, skip bad rows, import the rest. */
@Component({
  selector: 'app-bulk-upload',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './bulk-upload.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './bulk-upload.scss'],
})
export class BulkUpload {
  private readonly dialogRef = inject(MatDialogRef<BulkUpload, boolean>);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);

  readonly columns = this.users.csvColumns;
  readonly rows = signal<UserImportRow[]>([]);
  readonly error = signal<string | null>(null);
  readonly picked = signal(false);
  readonly ok = computed(() => this.rows().filter(r => !r.errs.length));
  readonly bad = computed(() => this.rows().filter(r => r.errs.length));

  downloadSample(): void {
    const csv = toCsv(this.columns, this.users.sampleCsvRows());
    saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'sharp-users-sample.csv');
  }

  onFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.rows.set([]);
    this.error.set(null);
    this.picked.set(!!file);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = this.users.previewImport(String(reader.result ?? ''));
      this.rows.set(result.rows);
      this.error.set(result.error ?? null);
    };
    reader.readAsText(file);
  }

  import(): void {
    const n = this.users.importUsers(this.rows());
    if (!n) return;
    this.toast.success(`${n} users imported`);
    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
