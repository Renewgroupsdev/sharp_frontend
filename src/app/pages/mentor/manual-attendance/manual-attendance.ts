import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { AttendanceRequestsService } from '../../../shared/common-services/attendance-requests.service';
import { AttendanceService } from '../../../shared/common-services/attendance.service';
import { GroupMember, MentorGroupService } from '../../../shared/common-services/mentor-group.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';

const REASONS = ['Medical', 'Off-site industry visit', 'Late arrival, verified', 'Device / GPS failure'];

@Component({
  selector: 'app-manual-attendance',
  standalone: true,
  templateUrl: './manual-attendance.html',
  styleUrls: ['../mentor.scss'],
})
export class ManualAttendance implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly attendance = inject(AttendanceService);
  private readonly requestStore = inject(AttendanceRequestsService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);
  readonly group = inject(MentorGroupService);

  readonly reasons = REASONS;
  readonly picking = signal<GroupMember | null>(null);

  readonly iso = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  readonly todayLabel = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  readonly rows = computed(() => this.group.members().map(m => {
    const rec = this.attendance.items().find(r => r.sid === m.id && r.iso === this.iso);
    return { m, rec };
  }));

  /** Requests from this mentor's students only. */
  readonly requests = computed(() => {
    const ids = new Set(this.group.members().map(m => m.id));
    return this.requestStore.items().filter(r => ids.has(r.sid));
  });
  readonly pending = computed(() => this.requests().filter(r => r.outcome === 'Pending'));
  readonly resolved = computed(() => this.requests().filter(r => r.outcome !== 'Pending'));

  ngOnInit(): void {
    this.attendance.load().catch(() => undefined);
    this.requestStore.loadFromApi().catch(e => this.toast.error('Could not load attendance requests', apiErrorMessage(e)));
  }

  async mark(m: GroupMember, reason: string): Promise<void> {
    const me = this.auth.actor();
    try {
      await this.attendance.mark(m.id, 'Present', reason, this.iso);
    } catch (e) {
      return void this.toast.error('Could not save the attendance', apiErrorMessage(e));
    }
    this.log.record('Attendance Management', `${me.n} marked ${m.n} present manually — ${reason}`);
    this.picking.set(null);
    this.toast.success('Marked present', `${m.n} marked present — ${reason.toLowerCase()}`);
  }

  async resolve(id: string, decision: 'Present' | 'Absent'): Promise<void> {
    try {
      await this.requestStore.mark(id, decision);
    } catch (e) {
      return void this.toast.error('Could not mark the attendance', apiErrorMessage(e));
    }
    this.toast.success(`Marked ${decision.toLowerCase()}`);
  }
}
