/** GET /dashboard/activity: what people did, from the audit log. Kinds come in a fixed order so each keeps its colour. */
export interface ActivityKind { name: string; count: number }

export interface ActivityDay {
  /** YYYY-MM-DD */
  date: string;
  total: number;
  by: Record<string, number>;
}

export interface ActivityPerson { name: string; role: string; count: number }

export interface ActivityRecent { action: string; by: string | null; at: string; kind: string }

export interface ActivityReport {
  days: number;
  total: number;
  kinds: ActivityKind[];
  by_day: ActivityDay[];
  people: ActivityPerson[];
  recent: ActivityRecent[];
}

export const ACTIVITY_RANGES = [7, 14, 30, 90] as const;
