import { Component, computed, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CoursesService } from '../../../shared/common-services/courses.service';

/** Read-only sheet for one course category, with the courses that use it. */
@Component({
  selector: 'app-category-view',
  standalone: true,
  imports: [MatDialogModule],
  templateUrl: './category-view.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './category-view.scss'],
})
export class CategoryView {
  private readonly dialogRef = inject(MatDialogRef<CategoryView>);
  private readonly data = inject<{ categoryId: string }>(MAT_DIALOG_DATA);
  private readonly store = inject(CoursesService);

  readonly category = computed(() => this.store.categories.get(this.data.categoryId));
  readonly courses = computed(() => {
    const k = this.category();
    return k ? this.store.items().filter(c => !c.deleted && c.category === k.n) : [];
  });

  readonly publishedCount = computed(() => this.courses().filter(c => c.status === 'Published').length);

  close(): void { this.dialogRef.close(); }
}
