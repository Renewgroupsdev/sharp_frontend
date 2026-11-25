import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { RoleDashboard } from '../../shared/components/role-dashboard/role-dashboard';
import { SubmissionStatsCard } from '../../shared/components/submission-stats/submission-stats';
import { AnalyticsDashboard } from './analytics-dashboard/analytics-dashboard';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [SubmissionStatsCard, RoleDashboard, AnalyticsDashboard],
  templateUrl: './dashboard.html',
  styleUrls: ['../../shared/styles/erp-page.scss', './dashboard.scss'],
})
export class Dashboard {
  private readonly auth = inject(AuthService);

  /** Super Admin and Admin get the analytics dashboard; OB, Member and Institution see only their own figures. */
  readonly classic = computed(() => ['Super Admin', 'Admin'].includes(this.auth.role() ?? ''));
}
