import { NgClass } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { BatchEnrollment } from '../../../shared/models/batch-enrollment.model';

interface Cell {
  /** null for the blanks before the 1st. */
  day: number | null;
  iso: string;
  starts: BatchEnrollment[];
  ends: BatchEnrollment[];
  running: BatchEnrollment[];
  today: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Month calendar of course runs: green dots mark the days a run starts, red the days it ends; pick a day to list what runs. */
@Component({
  selector: 'app-enrollment-calendar',
  standalone: true,
  imports: [NgClass],
  templateUrl: './enrollment-calendar.html',
  styleUrl: './enrollment-calendar.scss',
})
export class EnrollmentCalendar {
  readonly items = input.required<BatchEnrollment[]>();
  readonly openEnrollment = output<string>();

  protected readonly weekdays = WEEKDAYS;
  private readonly view = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  protected readonly picked = signal(isoOf(new Date()));

  protected readonly label = computed(() => this.view().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));

  protected readonly cells = computed<Cell[]>(() => {
    const first = this.view(), y = first.getFullYear(), m = first.getMonth();
    const total = new Date(y, m + 1, 0).getDate();
    const today = isoOf(new Date());
    const dated = this.items().filter(e => e.startIso || e.endIso);
    const out: Cell[] = Array.from({ length: (first.getDay() + 6) % 7 }, () => ({ day: null, iso: '', starts: [], ends: [], running: [], today: false }));
    for (let d = 1; d <= total; d++) {
      const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
      out.push({
        day: d, iso, today: iso === today,
        starts: dated.filter(e => e.startIso === iso),
        ends: dated.filter(e => e.endIso === iso),
        running: dated.filter(e => (!e.startIso || e.startIso <= iso) && (!e.endIso || e.endIso >= iso)),
      });
    }
    return out;
  });

  /** The picked day's cell, with the runs that start, end and are running that day. */
  protected readonly day = computed(() => this.cells().find(c => c.iso === this.picked()) ?? null);

  protected readonly dayLabel = computed(() => new Date(this.picked() + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }));

  protected shift(by: number): void {
    const v = this.view();
    const next = new Date(v.getFullYear(), v.getMonth() + by, 1);
    this.view.set(next);
    this.picked.set(isoOf(next));
  }

  protected goToday(): void {
    const t = new Date();
    this.view.set(new Date(t.getFullYear(), t.getMonth(), 1));
    this.picked.set(isoOf(t));
  }
}
