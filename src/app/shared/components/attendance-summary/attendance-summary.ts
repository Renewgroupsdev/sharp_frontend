import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { AttendanceApi, AttendanceSummaryData } from '../../common-services/attendance-api.service';

/**
 * Attendance percentages of one student: month by month (days attended out of the working days of the month), and per
 * course (days attended out of the working days between the course's start and end dates). Leave `studentId` empty for the
 * signed-in student's own figures.
 */
@Component({
  selector: 'app-attendance-summary',
  standalone: true,
  templateUrl: './attendance-summary.html',
  styleUrl: './attendance-summary.scss',
})
export class AttendanceSummary {
  private readonly api = inject(AttendanceApi);

  readonly studentId = input<string | null>(null);

  protected readonly data = signal<AttendanceSummaryData | null>(null);
  protected readonly monthsAsc = computed(() => [...(this.data()?.months ?? [])].reverse());
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => { void this.load(this.studentId()); });
  }

  private async load(id: string | null): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.data.set(await this.api.summary(id ?? undefined));
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected tone(pct: number): string { return pct >= 75 ? 'good' : pct >= 50 ? 'mid' : 'low'; }

  protected day(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
