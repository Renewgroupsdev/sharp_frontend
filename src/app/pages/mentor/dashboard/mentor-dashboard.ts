import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { MENTOR } from '../../../core/data/programme-data';
import { AttendanceRequestsService } from '../../../shared/common-services/attendance-requests.service';
import { AttendanceService } from '../../../shared/common-services/attendance.service';
import { CertificatesService } from '../../../shared/common-services/certificates.service';
import { MentorGroupService } from '../../../shared/common-services/mentor-group.service';
import { RoleDashboard } from '../../../shared/components/role-dashboard/role-dashboard';
import { SubmissionStatsCard } from '../../../shared/components/submission-stats/submission-stats';
import { WelcomeHero } from '../../../shared/components/welcome-hero/welcome-hero';

@Component({
  selector: 'app-mentor-dashboard',
  standalone: true,
  imports: [RouterLink, SubmissionStatsCard, RoleDashboard, WelcomeHero],
  templateUrl: './mentor-dashboard.html',
  styleUrls: ['../mentor.scss'],
})
export class MentorDashboard {
  private readonly auth = inject(AuthService);
  private readonly attendance = inject(AttendanceService);
  private readonly requests = inject(AttendanceRequestsService);
  readonly group = inject(MentorGroupService);
  private readonly certificates = inject(CertificatesService);
  readonly mentor = MENTOR;
  readonly me = this.auth.actor;
  /** Certificates of the mentor's batch that the mentor has not reviewed yet. */
  readonly certsWaiting = this.certificates.awaitingMentor;

  constructor() {
    this.certificates.load({ status: 'Pending' }).catch(() => undefined);
  }

  readonly actions = [
    { link: '/app/manual-attendance', icon: 'bi-geo-alt', title: 'Manual attendance', sub: 'Mark a student present with a reason' },
    { link: '/app/unlock-module', icon: 'bi-unlock', title: 'Unlock a module', sub: 'Override the sequence, with a recorded reason' },
    { link: '/app/certificate-review', icon: 'bi-award', title: 'Certificate approval', sub: 'Approve certificates earned by your group' },
    { link: '/app/group-progress', icon: 'bi-bar-chart-line', title: 'Group progress', sub: 'Module and assessment status per member' },
    { link: '/app/community', icon: 'bi-chat-dots', title: 'SHARP Community', sub: 'Group discussions and personal messages' },
  ];

  private readonly ids = computed(() => new Set(this.group.members().map(m => m.id)));
  readonly pendingRequests = computed(() => this.requests.items().filter(r => r.outcome === 'Pending' && this.ids().has(r.sid)).length);
  readonly presentToday = computed(() => {
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return this.group.members().filter(m => this.attendance.items().some(r => r.sid === m.id && r.iso === iso && r.status === 'Present')).length;
  });
  readonly avgProgress = computed(() => {
    const m = this.group.members();
    return m.length ? Math.round(m.reduce((s, x) => s + x.p, 0) / m.length) : 0;
  });
}
