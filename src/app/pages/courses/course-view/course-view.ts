import { Component, computed, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { EnrollmentService } from '../../../shared/common-services/enrollment.service';
import { HOST_ICON, lessonsOf, listify, mentorsOf } from '../../../shared/models/course.model';

/** Read-only course sheet: the admin "details" view, or a preview of how learners see it in the app ("frontend"). */
@Component({
  selector: 'app-course-view',
  standalone: true,
  imports: [MatDialogModule],
  templateUrl: './course-view.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './course-view.scss'],
})
export class CourseView {
  private readonly dialogRef = inject(MatDialogRef<CourseView>);
  private readonly data = inject<{ courseId: string; mode: 'details' | 'frontend' }>(MAT_DIALOG_DATA);
  private readonly store = inject(CoursesService);
  private readonly enrollments = inject(EnrollmentService);

  readonly frontend = this.data.mode === 'frontend';
  readonly hostIcon = HOST_ICON;
  readonly course = computed(() => this.store.get(this.data.courseId));

  readonly view = computed(() => {
    const c = this.course();
    if (!c) return null;
    return {
      lessons: lessonsOf(c).length,
      mentors: mentorsOf(c).join(', ') || 'Unassigned',
      batches: c.batches.join(', ') || 'No batch mapped',
      students: this.enrollments.forCourse(c.title).length,
      outcomes: listify(c.outcomes),
      reqs: listify(c.reqs),
      notice: c.status !== 'Published'
        ? `This course is ${c.status.toLowerCase()} — learners cannot see it yet.`
        : c.scope === 'Private' ? 'Private course — visible only to enrolled students.' : '',
    };
  });

  close(): void { this.dialogRef.close(); }
}
