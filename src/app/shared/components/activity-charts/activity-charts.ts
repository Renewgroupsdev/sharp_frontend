import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ActivityReportService } from '../../common-services/activity-report.service';
import { ACTIVITY_RANGES, ActivityDay, ActivityReport } from '../../models/activity-report.model';

const W = 640;
const H = 230;
const PAD = { left: 34, right: 8, top: 10, bottom: 26 };
const RADIUS = 66;
const CIRC = 2 * Math.PI * RADIUS;

const short = (iso: string): string => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** A tidy top for the y axis: 1, 2, 5, 10, 20, 50... times a power of ten. */
const niceMax = (n: number): number => {
  if (n <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(n));
  return ([1, 2, 5, 10].find(m => m * p >= n) ?? 10) * p;
};

/**
 * The dashboard's picture of everything people did: actions per day by kind (stacked columns), the share of each kind
 * (donut), the busiest people (bars) and the latest actions. The numbers come from the audit log through the API.
 * Colours follow the kind in a fixed order; a table view shows the same numbers for anyone who prefers them.
 */
@Component({
  selector: 'app-activity-charts',
  standalone: true,
  templateUrl: './activity-charts.html',
  styleUrl: './activity-charts.scss',
})
export class ActivityCharts implements OnInit {
  private readonly api = inject(ActivityReportService);

  protected readonly ranges = ACTIVITY_RANGES;
  protected readonly range = signal<number>(14);
  protected readonly report = signal<ActivityReport | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly table = signal(false);
  protected readonly hover = signal<number | null>(null);

  protected readonly w = W;
  protected readonly h = H;
  protected readonly plot = { x0: PAD.left, x1: W - PAD.right, y0: H - PAD.bottom, y1: PAD.top };
  protected readonly radius = RADIUS;

  protected readonly kinds = computed(() => this.report()?.kinds ?? []);
  protected readonly max = computed(() => niceMax(Math.max(0, ...(this.report()?.by_day ?? []).map(d => d.total))));
  protected readonly ticks = computed(() => [0, 1, 2, 3, 4].map(i => ({ value: (this.max() / 4) * i, y: this.y((this.max() / 4) * i) })));

  /** One column per day, its segments stacked in the fixed kind order with the zero-height ones left out. */
  protected readonly columns = computed(() => {
    const days = this.report()?.by_day ?? [];
    const slot = (this.plot.x1 - this.plot.x0) / Math.max(days.length, 1);
    const bar = Math.max(4, Math.min(34, slot * 0.68));
    return days.map((d, i) => {
      let top = this.plot.y0;
      const segments = this.kinds().filter(k => (d.by[k.name] ?? 0) > 0).map(k => {
        const height = (this.plot.y0 - this.y(d.by[k.name])) ;
        top -= height;
        return { kind: k.name, y: top, height, color: this.color(k.name) };
      });
      return { index: i, day: d, x: this.plot.x0 + slot * i + (slot - bar) / 2, width: bar, cx: this.plot.x0 + slot * i + slot / 2, segments, label: short(d.date) };
    });
  });

  /** The date labels to print: about seven, so they never collide. */
  protected readonly dateLabels = computed(() => {
    const cols = this.columns();
    const step = Math.max(1, Math.ceil(cols.length / 7));
    return cols.filter((_, i) => i % step === 0 || i === cols.length - 1);
  });

  protected readonly slices = computed(() => {
    const total = this.report()?.total ?? 0;
    let offset = 0;
    return this.kinds().filter(k => k.count > 0).map(k => {
      const length = total ? (k.count / total) * CIRC : 0;
      const slice = { ...k, color: this.color(k.name), length, offset, percent: Math.round((k.count / total) * 100) };
      offset += length;
      return slice;
    });
  });

  protected readonly peopleMax = computed(() => Math.max(1, ...(this.report()?.people ?? []).map(p => p.count)));
  protected readonly tip = computed(() => {
    const i = this.hover();
    const col = i === null ? null : this.columns()[i];
    return col ? { col, leftPct: (col.cx / W) * 100, rows: this.kinds().filter(k => (col.day.by[k.name] ?? 0) > 0) } : null;
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async pick(days: number): Promise<void> {
    this.range.set(days);
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.report.set(await this.api.load(this.range()));
      this.error.set(null);
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected y(value: number): number {
    return this.plot.y0 - (value / this.max()) * (this.plot.y0 - this.plot.y1);
  }

  /** The kind's colour variable; the last kind ("Other") is the neutral grey. */
  protected color(kind: string): string {
    const i = this.kinds().findIndex(k => k.name === kind);
    return i >= 0 && i < this.kinds().length - 1 ? `var(--k${i + 1})` : 'var(--k-other)';
  }

  protected percent(n: number): number {
    const total = this.report()?.total ?? 0;
    return total ? Math.round((n / total) * 100) : 0;
  }

  protected dayLabel(d: ActivityDay): string { return short(d.date); }

  /** "5 min ago", "2 h ago", "3 d ago". */
  protected ago(iso: string): string {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`;
  }
}
