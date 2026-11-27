import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { AnalyticsService } from '../../../shared/common-services/analytics.service';
import { ANALYTICS_RANGES, Analytics, LabelValue } from '../../../shared/models/analytics.model';

const R = 40;
const CIRC = 2 * Math.PI * R;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GREENS = ['#4a82c9', '#5b93d8', '#7aa9e0'];

const pct = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** A tidy top for an axis: 1, 2, 5, 10... times a power of ten. */
const niceMax = (n: number): number => {
  if (n <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(n));
  return ([1, 2, 5, 10].find(m => m * p >= n) ?? 10) * p;
};

interface Slice { label: string; value: number; percent: number; color: string; length: number; offset: number }

/** Rings for a donut: each slice's stroke length and offset on a circle of radius 40. */
const donut = (items: LabelValue[], colors: string[]): Slice[] => {
  const total = items.reduce((s, i) => s + i.value, 0);
  let offset = 0;
  return items.map((item, i) => {
    const length = total ? (item.value / total) * CIRC : 0;
    const slice = { ...item, percent: pct(item.value, total), color: colors[i % colors.length], length, offset };
    offset += length;
    return slice;
  });
};

/** Shown in the Super Admin and Admin dashboard: headline numbers, then one panel for each module with its charts. */
@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './analytics-dashboard.html',
  styleUrl: './analytics-dashboard.scss',
})
export class AnalyticsDashboard implements OnInit {
  private readonly api = inject(AnalyticsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly ranges = ANALYTICS_RANGES;
  protected readonly range = signal<number>(6);
  protected readonly data = signal<Analytics | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly role = this.auth.role;

  protected readonly days = DAYS;
  protected readonly circ = CIRC;
  protected readonly r = R;

  protected readonly kpis = computed(() => {
    const k = this.data()?.kpis;
    if (!k) return [];
    const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}%`;
    return [
      { route: 'users', label: 'Total Students', value: k.students.toLocaleString(), note: signed(k.students_growth), up: k.students_growth >= 0, icon: 'bi-people-fill' },
      { route: 'institutes', label: 'Institutes', value: k.institutes.toLocaleString(), note: `${k.institutes_active} Active`, up: null, icon: 'bi-bank2' },
      { route: 'courses', label: 'Courses', value: k.courses.toLocaleString(), note: signed(k.courses_growth), up: k.courses_growth >= 0, icon: 'bi-book-fill' },
      { route: 'institutes', label: 'Batches', value: k.batches.toLocaleString(), note: `${k.batches_upcoming} Upcoming`, up: null, icon: 'bi-layers-fill' },
      { route: 'users', label: 'Mentors', value: k.mentors.toLocaleString(), note: signed(k.mentors_growth), up: k.mentors_growth >= 0, icon: 'bi-person-badge-fill' },
      { route: 'attendance', label: 'Overall Attendance', value: `${k.attendance_rate}%`, note: signed(k.attendance_delta), up: k.attendance_delta >= 0, icon: 'bi-calendar-check-fill' },
    ];
  });

  /** Pending attendance for every date of this month as vertical bars: students who asked (waiting for a decision) beside students nobody has marked. */
  protected readonly pendingChart = computed(() => {
    const p = this.data()?.pending_attendance;
    if (!p) return null;
    const [year, month] = p.month.split('-').map(Number);
    const byDate = new Map(p.days.map(d => [d.date, d]));
    const max = Math.max(1, ...p.days.map(d => d.requested + d.not_marked));
    const today = new Date().toLocaleDateString('en-CA');
    const rows = Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => {
      const date = `${p.month}-${String(i + 1).padStart(2, '0')}`;
      const d = byDate.get(date);
      const requested = d?.requested ?? 0;
      const notMarked = d?.not_marked ?? 0;
      return {
        date, n: i + 1, requested, notMarked, today: date === today, future: date > today, clear: !!d && !requested && !notMarked,
        label: new Date(year, month - 1, i + 1).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        reqW: (requested / max) * 100, nmW: (notMarked / max) * 100,
      };
    });
    return {
      title: new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      rows: rows.filter(r => !r.future && (r.requested || r.notMarked)).reverse(),
      ticks: [4, 3, 2, 1, 0].map(i => Math.round((max / 4) * i)),
      requested: p.days.reduce((s, d) => s + d.requested, 0),
      notMarked: p.days.reduce((s, d) => s + d.not_marked, 0),
    };
  });

  /* ---------- attendance ---------- */
  protected readonly heatmap = computed(() => (this.data()?.attendance.heatmap ?? []).map(w => ({
    label: w.label,
    cells: w.cells.map((v, i) => ({ v, date: new Date(new Date(`${w.start}T00:00:00`).getTime() + i * 86_400_000).toLocaleDateString('en-CA'), level: v === null ? 0 : v >= 90 ? 4 : v >= 80 ? 3 : v >= 70 ? 2 : 1 })),
  })));
  /** Course attendance per batch (days attended out of the working days of the course dates). */
  protected readonly batchAttendance = computed(() => (this.data()?.attendance.batches ?? []).map(b => ({ name: b.name, rate: b.rate, students: b.students, tone: b.rate >= 75 ? 'good' : b.rate >= 50 ? 'mid' : 'low' })));

  /* ---------- users ---------- */
  protected readonly roleSlices = computed(() => {
    const roles = this.data()?.users.roles ?? [];
    const top = roles.slice(0, 4);
    const rest = roles.slice(4).reduce((s, r) => s + r.value, 0);
    return donut(rest ? [...top, { label: 'Others', value: rest }] : top, ['#5b93d8', '#e8b33f', '#4fb58a', '#e46f6f', '#9aa3b5']);
  });
  protected readonly registrations = computed(() => {
    const rows = this.data()?.users.registrations ?? [];
    const max = Math.max(1, ...rows.map(r => r.value));
    return rows.map((r, i) => ({ ...r, width: Math.max(r.value ? 6 : 0, (r.value / max) * 100), color: GREENS[Math.min(2, Math.floor((i / Math.max(rows.length, 1)) * 3))] }));
  });

  /* ---------- courses ---------- */
  protected readonly completion = computed(() => this.data()?.courses.completion ?? []);
  /** Two treemap rows: the first half of the categories on top, the rest below, each tile sized by its share. */
  protected readonly treemap = computed(() => {
    const items = (this.data()?.courses.enrollment ?? []).map((e, i) => ({ ...e, color: ['#5b93d8', '#8a7fd9', '#4fb58a', '#e8b33f'][i % 4] }));
    if (!items.length) return [];
    const split = Math.ceil(items.length / 2);
    const rows = [items.slice(0, split), items.slice(split)].filter(r => r.length);
    const total = items.reduce((s, i) => s + i.count, 0) || 1;
    return rows.map(row => {
      const sum = row.reduce((s, i) => s + i.count, 0);
      return { height: Math.max(25, (sum / total) * 100), tiles: row.map(t => ({ ...t, width: Math.max(20, (t.count / (sum || 1)) * 100) })) };
    });
  });

  /* ---------- assignments ---------- */
  protected readonly assignmentBatches = computed(() => (this.data()?.assignments.by_batch ?? []).map(b => {
    const total = b.submitted + b.pending + b.evaluated + b.overdue;
    return { name: b.name, total, submitted: pct(b.submitted, total), pending: pct(b.pending, total), evaluated: pct(b.evaluated, total), overdue: pct(b.overdue, total), counts: b };
  }));
  protected readonly assignmentFunnel = computed(() => this.funnel(this.data()?.assignments.funnel ?? [], ['#5b93d8', '#8a7fd9', '#d97db3', '#e8b33f']));

  /* ---------- assessments ---------- */
  protected readonly histogram = computed(() => {
    const rows = this.data()?.assessments.distribution ?? [];
    const max = niceMax(Math.max(0, ...rows.map(r => r.value)));
    return { rows: rows.map(r => ({ ...r, height: (r.value / max) * 100 })), ticks: [4, 3, 2, 1, 0].map(i => Math.round((max / 4) * i)) };
  });
  /** Combo chart in a 220x110 box: pass/fail columns per month and the average-score line. */
  protected readonly combo = computed(() => {
    const rows = this.data()?.assessments.trend ?? [];
    const max = niceMax(Math.max(0, ...rows.map(r => r.pass + r.fail)));
    const slot = 220 / Math.max(rows.length, 1);
    const bar = Math.min(18, slot * 0.6);
    const columns = rows.map((r, i) => {
      const x = slot * i + (slot - bar) / 2;
      const passH = (r.pass / max) * 100;
      const failH = (r.fail / max) * 100;
      return { label: r.label, x, bar, cx: slot * i + slot / 2, passH, failH, passY: 110 - passH, failY: 110 - passH - failH, total: r.pass + r.fail, avg: r.avg };
    });
    const pts = columns.filter(c => c.avg !== null).map(c => `${c.cx},${110 - (c.avg! / 100) * 100}`);
    return { columns, line: pts.join(' '), dots: pts.map(p => p.split(',').map(Number)), ticks: [4, 3, 2, 1, 0].map(i => Math.round((max / 4) * i)) };
  });

  /* ---------- quiz ---------- */
  /** Radar: one spoke per topic, the polygon reaching out to the topic's average score. */
  protected readonly radar = computed(() => {
    const topics = this.data()?.quiz.topics ?? [];
    const n = topics.length;
    if (n < 3) return null;
    const c = 100;
    const point = (i: number, v: number): [number, number] => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return [c + Math.cos(a) * 70 * (v / 100), c + Math.sin(a) * 70 * (v / 100)];
    };
    const ring = (v: number) => topics.map((_, i) => point(i, v).join(',')).join(' ');
    return {
      rings: [25, 50, 75, 100].map(ring),
      spokes: topics.map((_, i) => point(i, 100)),
      shape: topics.map((t, i) => point(i, t.value).join(',')).join(' '),
      dots: topics.map((t, i) => point(i, t.value)),
      labels: topics.map((t, i) => {
        const [x, y] = point(i, 116);
        return { text: t.label.length > 14 ? t.label.slice(0, 13) + '…' : t.label, x, y, value: t.value, anchor: x < 85 ? 'end' : x > 115 ? 'start' : 'middle' };
      }),
    };
  });
  /** Per student and quiz: Passed, Not passed (attempted, never passed) and Not attempted. */
  protected readonly quizSlices = computed(() => {
    const c = this.data()?.quiz.students;
    return donut([
      { label: 'Passed', value: c?.passed ?? 0 },
      { label: 'Not passed', value: c?.not_passed ?? 0 },
      { label: 'Not attempted', value: c?.not_attempted ?? 0 },
    ], ['#4fb58a', '#e46f6f', '#9aa3b2']);
  });

  /* ---------- certificates ---------- */
  protected readonly certSlices = computed(() => donut(this.data()?.certificates.status ?? [], ['#8a7fd9', '#e8b33f', '#5b93d8', '#e46f6f']));
  /** 3D pie of certificates by course category: an ellipse with a visible rim (walls on the front half) and % labels in each slice. */
  protected readonly pieHover = signal<number | null>(null);
  protected readonly uHover = signal<number | null>(null);
  protected readonly qHover = signal<number | null>(null);
  protected readonly cHover = signal<number | null>(null);

  protected readonly pie3d = computed(() => {
    const rows = this.data()?.certificates.by_category ?? [];
    const total = rows.reduce((s, r) => s + r.value, 0);
    if (!total) return null;
    const colors = ['#5b93d8', '#8a7fd9', '#4fb58a', '#e8b33f', '#d97db3', '#e46f6f'];
    const cx = 100, cy = 60, rx = 86, ry = 46, depth = 18, TAU = 2 * Math.PI;
    const p = (a: number, dy = 0) => `${(cx + rx * Math.cos(a)).toFixed(2)} ${(cy + ry * Math.sin(a) + dy).toFixed(2)}`;
    let a0 = -Math.PI / 2;
    const slices = rows.map((r, i) => {
      const share = r.value / total;
      const a1 = a0 + share * TAU;
      const mid = (a0 + a1) / 2;
      const walls: string[] = [];
      for (let k = Math.floor(a0 / TAU); k <= Math.floor(a1 / TAU); k++) {
        const lo = Math.max(a0, k * TAU);
        const hi = Math.min(a1, k * TAU + Math.PI);
        if (hi > lo + 1e-6) walls.push(`M ${p(lo)} A ${rx} ${ry} 0 0 1 ${p(hi)} L ${p(hi, depth)} A ${rx} ${ry} 0 0 0 ${p(lo, depth)} Z`);
      }
      const slice = {
        label: r.label, value: r.value, percent: Math.round(share * 100), color: colors[i % colors.length], walls,
        full: share > 0.9999,
        top: `M ${cx} ${cy} L ${p(a0)} A ${rx} ${ry} 0 ${share > 0.5 ? 1 : 0} 1 ${p(a1)} Z`,
        dx: rows.length === 1 ? 0 : Math.cos(mid) * 9, dy: rows.length === 1 ? 0 : Math.sin(mid) * 5,
        lx: cx + rx * (rows.length === 1 ? 0 : 0.6) * Math.cos(mid), ly: cy + ry * (rows.length === 1 ? 0 : 0.6) * Math.sin(mid) + 3,
      };
      a0 = a1;
      return slice;
    });
    return { slices, cx, cy, rx, ry, depth, height: cy + ry + depth + 4 };
  });

  /* ---------- community & logs ---------- */
  protected readonly engagement = computed(() => {
    const rows = this.data()?.community.engagement ?? [];
    const max = niceMax(Math.max(0, ...rows.map(r => r.value)));
    return { rows: rows.map(r => ({ ...r, height: (r.value / max) * 100 })), ticks: [4, 3, 2, 1, 0].map(i => Math.round((max / 4) * i)) };
  });
  protected readonly logHeat = computed(() => {
    const grid = this.data()?.logs.heatmap ?? [];
    const max = Math.max(1, ...grid.flat());
    return grid.map((row, d) => ({ day: DAYS[d], cells: row.map(n => ({ n, level: n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)) })) }));
  });
  protected readonly hours = ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'];

  /** Opens a list page already filtered to the data that was clicked (the page reads ?status= ?source= ?type= ?batch= ?q= ?from= ?to=). */
  protected go(page: string, params: Record<string, string | undefined> = {}): void {
    // The assessment pages sit under Course Management: /app/courses/{assignments|assessments|quiz}.
    const path = page === 'assessments' ? ['courses', ({ Assignment: 'assignments', Assessment: 'assessments', Quiz: 'quiz' } as Record<string, string>)[params['type'] ?? ''] ?? 'assessments'] : [page];
    void this.router.navigate(['/app', ...path], { queryParams: Object.fromEntries(Object.entries(params).filter(([, v]) => v)) });
  }

  /** The role name the Users page filters on, from the chart's plural label. */
  protected roleName(label: string): string {
    return ({ Students: 'Student', Mentors: 'Mentor', Institutions: 'Institution', OBs: 'OB', 'Super Admins': 'Super Admin', Admins: 'Admin', Trainers: 'Trainer', Members: 'Member' } as Record<string, string>)[label] ?? '';
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async pick(event: Event): Promise<void> {
    this.range.set(Number((event.target as HTMLSelectElement).value));
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.data.set(await this.api.load(this.range()));
      this.error.set(null);
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  /** Funnel stages narrow with their share of the first stage, never thinner than 42% so the label fits. */
  private funnel(rows: LabelValue[], colors: string[]) {
    const top = rows[0]?.value || 0;
    const widths = rows.map(r => Math.max(42, top ? (r.value / top) * 100 : 100));
    return rows.map((r, i) => ({ ...r, color: colors[i % colors.length], width: widths[i], next: widths[i + 1] ?? widths[i] * 0.8 }));
  }

  protected ago(iso: string): string {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} hr ago` : `${Math.round(min / 1440)} d ago`;
  }

  protected logIcon(kind: string, tone: string): string {
    if (tone === 'red') return 'bi-exclamation-triangle-fill';
    return { 'Users & access': 'bi-person-check-fill', Certificates: 'bi-patch-check-fill', Attendance: 'bi-calendar-check-fill', Learning: 'bi-pencil-square', Assessments: 'bi-journal-check', Community: 'bi-chat-dots-fill', Notifications: 'bi-bell-fill' }[kind] ?? 'bi-check-circle-fill';
  }
}
