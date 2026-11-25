import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../../core/auth/auth.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { CourseModules } from './course-modules';

/** "Modules / topics" of one course, opened from the course list. */
@Component({
  selector: 'app-course-modules-dialog',
  standalone: true,
  imports: [MatDialogModule, CourseModules],
  templateUrl: './course-modules-dialog.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class CourseModulesDialog {
  private readonly dialogRef = inject(MatDialogRef<CourseModulesDialog>);
  private readonly data = inject<{ courseId: string }>(MAT_DIALOG_DATA);
  readonly canEdit = inject(AuthService).hasActionAccess('a_courses.edit');

  readonly courseId = this.data.courseId;
  readonly course = inject(CoursesService).get(this.data.courseId);

  close(): void { this.dialogRef.close(); }
}
