export interface FollowUpEntry { id?: string | number; note?: string; at?: string; }

export type DetailTrendDirection = 'up' | 'down' | 'neutral';

export type DetailCardIconVariant = 'primary' | 'green' | 'orange' | 'blue' | 'purple';

export interface DetailCardData {
  label: string;
  value: string | number;
  trendText?: string;
  trendDirection?: DetailTrendDirection;
  icon?: string;
  iconVariant?: DetailCardIconVariant;
  sparkline?: number[];
}

export interface ChartDatum {
  label: string;
  value: number;
}

export interface BreadcrumbItem {
  label: string;
  link?: string | unknown[];
  icon?: string;
}

export interface FilterOption {
  key: string;
  label: string;
  options?: string[];
  multiSelect?: boolean;
}

export interface CommonFilterState {
  status: string | null;
  source: string | null;
  branch: string[];
  telecaller: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  type?: string | null;
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export type TableColumnType = 'text' | 'lead' | 'branch' | 'badge' | 'toggle' | 'expand' | 'action' | 'rowActions' | 'avatarGroup' | 'callLog' | 'quickActions' | 'countList' | 'countLink' | 'progress' | 'select' | 'longText';

export interface QuickAction {
  key: string;
  icon: string;
  label: string;
  variant?: 'primary' | 'danger' | 'default';
  /** Roles & Permissions action slug; the table hides the button when the role is not ticked on it. */
  permission?: string;
}

export interface TableColumn {
  key: string;
  header: string;
  type?: TableColumnType;
  /** Preferred share of the table width, e.g. '10%'. Shares are normalised, so adding columns never overflows the card. */
  width?: string;
  /** Smallest readable width in px (default 100, or the button width for action columns). The table scrolls sideways rather than squeezing a column below this. */
  minWidth?: number;
  sortable?: boolean;
  /** quickActions columns only: collapse the buttons into a three-dot dropdown menu. */
  menu?: boolean;
}

export interface LeadCell {
  name: string;
  subtitle?: string;
  /** Optional thumbnail shown in place of the initials avatar. */
  photo?: string;
}

export interface CallerAvatar {
  name: string;
  empNo: string;
  image?: string;
}

export interface CallerLogEntry {
  telecallerName: string;
  empNo: string;
  dateTime: string;
  notes: string;
}

/** A progress column shows a bar with the percentage; `sub` is an optional line under it. */
export interface ProgressCell {
  /** 0-100. */
  value: number;
  sub?: string;
}

/** A countList column holds the list's items; the cell shows their count and lists them on hover or click. */
export type TableRow = Record<string, string | number | string[] | ProgressCell | LeadCell | CallerAvatar[] | CallerLogEntry[] | FollowUpEntry[] | QuickAction[]>;

export interface TablePageChangeEvent {
  page: number;
  pageSize: number;
}

export interface TableReorderEvent {
  previousIndex: number;
  currentIndex: number;
  rows: TableRow[];
}

export interface TableTransferEvent {
  row: TableRow;
  previousIndex: number;
  currentIndex: number;
  previousContainerId: string;
  currentContainerId: string;
}
/** One segment of the count ribbon. `key` is what a click emits (defaults to `label`); `hoverItems` fills the hover popup. */
export interface RibbonItem {
  label: string;
  value: string | number;
  icon?: string;
  key?: string;
  /** Explicit colour; otherwise derived from `iconVariant`, then from the item's position. */
  color?: string;
  iconVariant?: DetailCardIconVariant;
  hoverItems?: { name: string; sub?: string }[];
  /** Clicking the tab applies this list filter (status / source slot of the filter card). */
  filter?: { key: RibbonFilterKey; value: string };
}

export type RibbonFilterKey = 'status' | 'source';
