import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Institute } from '../../../core/data/models';
import { InstitutesService } from '../../../shared/common-services/institutes.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { InstituteInput } from '../../../shared/models/institute.model';

const PHONE_PATTERN = /^[+\d][\d\s\-]{6,17}$/;

/** Create / edit a college or institute. */
@Component({
  selector: 'app-institute-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './institute-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class InstituteForm {
  private readonly dialogRef = inject(MatDialogRef<InstituteForm, Institute | undefined>);
  private readonly data = inject<{ instituteId?: string }>(MAT_DIALOG_DATA);
  private readonly store = inject(InstitutesService);
  private readonly toast = inject(ToastService);

  readonly existing = this.data.instituteId ? this.store.get(this.data.instituteId) : undefined;
  readonly isEdit = !!this.existing;
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly statuses: InstituteInput['st'][] = ['Active', 'Inactive'];
  readonly phonePattern = PHONE_PATTERN;

  model: InstituteInput = this.existing
    ? {
        n: this.existing.n, city: this.existing.city, pr: this.existing.pr, email: this.existing.email,
        ph: this.existing.ph, st: this.existing.st, lat: this.existing.lat, lng: this.existing.lng,
        geofenceRadiusM: this.existing.geofenceRadiusM ?? 200,
      }
    : { n: '', city: 'Madurai', pr: '', email: '', ph: '', st: 'Active', lat: null, lng: null, geofenceRadiusM: 200 };

  /** Code the new institute will get; existing institutes keep theirs because student IDs are built from it. */
  get codePreview(): string {
    return this.existing?.code ?? (this.model.n.trim() ? this.store.codeFor(this.model.n) : '—');
  }

  /** Validates, saves and closes with the saved record; a duplicate name is reported inline. */
  // save(form: NgForm): void {
  //   this.submitted.set(true);
  //   this.serverError.set(null);
  //   if (form.invalid) return;
  //   if (this.store.nameTaken(this.model.n, this.existing?.id)) {
  //     return void this.serverError.set(`An institute named "${this.model.n.trim()}" already exists.`);
  //   }
  //   const rec = this.store.saveInstitute(this.model, this.existing?.id);
  //   this.toast.success(this.isEdit ? 'Institute updated' : `Institute ${rec.code} created`);
  //   this.dialogRef.close(rec);
  // }
  readonly saving = signal(false);

  async save(form: NgForm): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);

    if (form.invalid || this.saving()) return;

    if (this.store.nameTaken(this.model.n, this.existing?.id)) {
      this.serverError.set(
        `An institute named "${this.model.n.trim()}" already exists.`
      );
      return;
    }

    this.saving.set(true);
    try {
      const institute = await this.store.saveInstitute(this.model, this.existing?.id);
      this.toast.success(`Institute ${institute.code} ${this.isEdit ? 'updated' : 'created'}`);
      this.dialogRef.close(institute);
    } catch (error) {
      this.serverError.set(
        error instanceof Error ? error.message : `Unable to ${this.isEdit ? 'update' : 'create'} institute.`
      );
    } finally {
      this.saving.set(false);
    }
  }
  close(): void {
    this.dialogRef.close();
  }
}
