import { Component, OnInit, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../core/auth/auth.service';
import { MyLearningService } from '../../../shared/common-services/my-learning.service';
import { UsersService } from '../../../shared/common-services/users.service';
import { MyProfile } from '../../../shared/components/my-profile/my-profile';

/** The student's own profile, from their account and their courses, with an Edit profile button. */
@Component({
  selector: 'app-student-profile',
  standalone: true,
  templateUrl: './student-profile.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', '../student.scss'],
})
export class StudentProfile implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly learning = inject(MyLearningService);
  private readonly dialog = inject(MatDialog);

  protected readonly me = computed(() => this.auth.actor());
  protected readonly courses = this.learning.courses;
  protected readonly overall = computed(() => {
    const list = this.courses();
    return list.length ? Math.round(list.reduce((a, c) => a + c.progress, 0) / list.length) : 0;
  });
  protected readonly mentors = computed(() => [...new Set(this.courses().flatMap(c => c.mentors))].join(', ') || 'Not assigned yet');

  protected readonly rows = computed<[string, string][]>(() => {
    const u = this.me();
    return [
      ['Student ID', u.id], ['Username', u.username || '—'], ['Batch', u.b || '—'], ['College', u.org || '—'],
      ['Mobile', u.ph || '—'], ['Email', u.email || '—'], ['Mentor', this.mentors()], ['Last sign-in', u.last || '—'],
    ];
  });

  ngOnInit(): void {
    void this.users.refresh();
    this.learning.load().catch(() => undefined);
  }

  protected edit(): void {
    this.dialog.open(MyProfile, { width: '640px', maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', autoFocus: false, restoreFocus: true });
  }
}
