import { Component, inject } from '@angular/core';
import { MODULES, STUDENT, TEAM } from '../../../core/data/programme-data';
import { LearnerStateService } from '../../../shared/common-services/learner-state.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { StudentProgress } from '../student-progress.service';

@Component({
  selector: 'app-student-profile',
  standalone: true,
  templateUrl: './student-profile.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', '../student.scss'],
})
export class StudentProfile {
  private readonly toast = inject(ToastService);
  protected readonly progress = inject(StudentProgress);
  protected readonly learner = inject(LearnerStateService);
  protected readonly student = STUDENT;
  protected readonly modules = MODULES;
  protected readonly rows: [string, string][] = [
    ['Student ID', STUDENT.id], ['Batch', STUDENT.batch], ['College', STUDENT.college], ['Course', STUDENT.course], ['Mobile', STUDENT.phone],
    ['Email', STUDENT.email], ['Mentor', STUDENT.mentorName], ['Team', `${STUDENT.team} · ${TEAM.length} students`], ['Joined', STUDENT.joined],
  ];

  protected requestChange(): void {
    this.toast.success('Request sent', 'Profile edit request sent to the programme office');
  }
}
