import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { LearningService } from '../../../shared/common-services/learning.service';
import { ModuleProgress } from '../../../shared/models/learning.model';

/** Per-module progress report for one learning record, from the student's completed lessons. Closes with `true` when the user asks to edit the record. */
@Component({
  selector: 'app-learning-report',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './learning-report.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './learning-report.scss'],
})
export class LearningReport implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<LearningReport, boolean>);
  private readonly data = inject<{ id: string }>(MAT_DIALOG_DATA);
  private readonly store = inject(LearningService);
  readonly canEdit = inject(AuthService).can('a_learn', 'u');

  readonly record = this.store.get(this.data.id);
  readonly modules = signal<ModuleProgress[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      if (this.record) this.modules.set(await this.store.moduleReport(this.record));
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  edit(): void {
    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
