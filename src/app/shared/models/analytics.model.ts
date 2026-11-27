/** GET /dashboard/analytics: every module's figures for the Super Admin analytics dashboard. */
export interface LabelValue { label: string; value: number }

export interface AnalyticsKpis {
  students: number; students_growth: number;
  institutes: number; institutes_active: number;
  courses: number; courses_growth: number;
  batches: number; batches_upcoming: number;
  mentors: number; mentors_growth: number;
  attendance_rate: number; attendance_delta: number;
}

export interface AttendanceWeek { label: string; start: string; cells: (number | null)[] }
export interface BatchAttendance { name: string; rate: number; students: number }
export interface BatchAssignments { name: string; submitted: number; pending: number; evaluated: number; overdue: number }
export interface TrendPoint { label: string; pass: number; fail: number; avg: number | null }
export interface FeedItem { text: string; at: string; tone: 'green' | 'amber' | 'red' }
export interface LogItem extends FeedItem { by: string | null; kind: string }

export interface Analytics {
  months: number;
  generated_at: string;
  kpis: AnalyticsKpis;
  pending_attendance: { month: string; days: { date: string; requested: number; not_marked: number; total: number }[] };
  attendance: { heatmap: AttendanceWeek[]; batches: BatchAttendance[] };
  users: { total: number; roles: LabelValue[]; registrations: LabelValue[] };
  courses: { completion: LabelValue[]; enrollment: (LabelValue & { count: number })[] };
  assignments: { by_batch: BatchAssignments[]; funnel: LabelValue[] };
  assessments: { distribution: LabelValue[]; trend: TrendPoint[] };
  quiz: { topics: LabelValue[]; students: { passed: number; not_passed: number; not_attempted: number; total: number } };
  certificates: { total: number; status: LabelValue[]; by_category: LabelValue[] };
  community: { recent: FeedItem[]; engagement: LabelValue[] };
  logs: { recent: LogItem[]; heatmap: number[][] };
}

export const ANALYTICS_RANGES = [
  { months: 1, label: 'Last Month' },
  { months: 3, label: 'Last 3 Months' },
  { months: 6, label: 'Last 6 Months' },
  { months: 12, label: 'Last 12 Months' },
] as const;
