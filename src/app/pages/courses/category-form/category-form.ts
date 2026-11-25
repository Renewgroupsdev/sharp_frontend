import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { ToastService } from '../../../shared/common-services/toast.service';

/** Add / edit a course category. */
@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './category-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class CategoryForm {
  private readonly dialogRef = inject(MatDialogRef<CategoryForm, boolean>);
  private readonly data = inject<{ categoryId?: string }>(MAT_DIALOG_DATA);
  private readonly store = inject(CoursesService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);

  readonly existing = this.data.categoryId ? this.store.categories.get(this.data.categoryId) : undefined;
  readonly isEdit = !!this.existing;
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly saving = signal(false);

  model = { n: this.existing?.n ?? '', desc: this.existing?.desc ?? '', st: this.existing?.st ?? 'Active' };

  close(): void { this.dialogRef.close(false); }

  async save(form: NgForm): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    const name = this.model.n.trim();
    if (form.invalid || !name) return;
    if (this.store.categories.items().some(x => x.id !== this.existing?.id && x.n.toLowerCase() === name.toLowerCase())) {
      this.serverError.set('That category already exists');
      return;
    }
    this.saving.set(true);
    try {
      await this.store.saveCategory({ n: name, desc: this.model.desc.trim(), st: this.model.st }, this.existing?.id);
      this.log.record('Course Management', `${this.existing ? 'Updated' : 'Added'} category ${name}`);
      this.toast.success(this.existing ? 'Category updated' : 'Category added');
      this.dialogRef.close(true);
    } catch (error) {
      this.serverError.set(apiErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
