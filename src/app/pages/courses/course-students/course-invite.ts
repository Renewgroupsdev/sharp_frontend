import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { EnrollmentService } from '../../../shared/common-services/enrollment.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { mentorsOf } from '../../../shared/models/course.model';

/** Send a course invitation to the course mentors and / or its enrolled students. */
@Component({
  selector: 'app-course-invite',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './course-invite.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './course-students.scss'],
})
export class CourseInvite {
  private readonly dialogRef = inject(MatDialogRef<CourseInvite, boolean>);
  private readonly data = inject<{ courseId: string }>(MAT_DIALOG_DATA);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);

  readonly course = inject(CoursesService).get(this.data.courseId);
  readonly mentorCount = this.course ? mentorsOf(this.course).length : 0;
  readonly studentCount = this.course ? inject(EnrollmentService).forCourse(this.course.title).length : 0;
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);

  model = {
    toMentors: true,
    toStudents: true,
    msg: this.course
      ? `You are invited to “${this.course.title}” (${this.course.mode}, ${this.course.hours} hours). Open the SHARP app to view the course.`
      : '',
  };

  close(): void { this.dialogRef.close(false); }

  send(): void {
    this.submitted.set(true);
    this.serverError.set(null);
    const c = this.course, msg = this.model.msg.trim();
    if (!c || !msg) return;
    const mentors = this.model.toMentors ? this.mentorCount : 0;
    const students = this.model.toStudents ? this.studentCount : 0;
    if (!mentors && !students) return this.serverError.set('Choose at least one recipient group that has people in it');
    this.log.record('Course Management', `Invitation for ${c.title} sent to ${mentors} mentor(s) and ${students} student(s)`);
    this.toast.success('Invitation sent', `${mentors} mentor(s) and ${students} student(s) notified.`);
    this.dialogRef.close(true);
  }
}
