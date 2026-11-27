/** GET /my/dashboard: the signed-in person's dashboard as figures and blocks, whatever their role. The API scopes every number. */
export type KpiRow = [label: string, value: string | number, hint: string];

export interface PieBlock { type: 'pie'; title: string; three_d?: boolean; slices: { label: string; value: number }[] }
export interface BarsBlock { type: 'bars'; title: string; unit: string; items: { label: string; value: number }[] }
export interface ProgressBlock { type: 'progress'; title: string; items: { label: string; value: number }[] }

export interface ListItem {
  text: string;
  /** Small pill on the right (a count, a date, a status), or ''. */
  badge: string;
  /** '', 'red' or 'amber'. */
  tone: string;
  /** Where the line leads in the app, or null. */
  url: string | null;
}
export interface ListBlock { type: 'list'; title: string; items: ListItem[] }

export type DashboardBlock = PieBlock | BarsBlock | ProgressBlock | ListBlock;

export interface RoleDashboardData {
  title: string;
  note: string | null;
  kpis: KpiRow[];
  blocks: DashboardBlock[];
}
