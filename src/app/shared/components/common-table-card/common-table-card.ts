import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragAxis, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, EventEmitter, HostListener, Input, Output, TemplateRef, ViewChild, inject } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { PortalDirective } from '../../directives/portal.directive';
import { PageLoader } from '../page-loader/page-loader';
import { AuthService } from '../../../core/auth/auth.service';
import { CallerAvatar, CallerLogEntry, LeadCell, QuickAction, TableColumn, TablePageChangeEvent, TableReorderEvent, TableRow, TableTransferEvent } from '../../models/common-components.model';

const STATUS_MAP: Record<string, 'green' | 'orange' | 'red' | 'gray' | 'blue'> = {
  qualified: 'green', active: 'green', completed: 'green', converted: 'green', paid: 'green', 'on time': 'green',
  contacted: 'orange', pending: 'orange', 'in progress': 'orange', due: 'orange', late: 'orange',
  lost: 'red', cancelled: 'red', failed: 'red', overdue: 'red',
  new: 'gray', draft: 'gray', inactive: 'gray',
  // Quiz attempts
  passed: 'green', 'not passed': 'red', 'needs review': 'orange', 'timed out': 'gray',
  scheduled: 'blue', follow: 'blue', upcoming: 'blue', ongoing: 'orange',
  // Purchase Management
  approved: 'green', received: 'green', adjusted: 'green', 'in stock': 'green', full: 'green',
  'partially received': 'orange', partial: 'orange', open: 'orange', 'debit note': 'orange',
  rejected: 'red', urgent: 'red', 'low stock': 'red', 'out of stock': 'red',
  ordered: 'blue', 'credit note': 'blue',
  // HR Management
  onboarding: 'blue', 'on notice': 'orange', exited: 'red',
  present: 'green', 'half day': 'orange', absent: 'red', 'on leave': 'blue', permission: 'blue', holiday: 'gray', 'not marked': 'gray',
  applied: 'gray', shortlisted: 'blue', interview: 'orange', interviewed: 'blue', selected: 'green', verification: 'orange', offered: 'blue', hired: 'green', 'offer declined': 'red',
  processed: 'blue', released: 'green', filled: 'green', 'on hold': 'gray', closed: 'gray',
  'notice period': 'orange', clearance: 'blue', settled: 'green',
  // Accounts
  unpaid: 'red', 'partially paid': 'orange', sent: 'blue',
  // Appointments
  'in consultation': 'orange', 'awaiting terms': 'orange', invoiced: 'blue', 'consultation only': 'gray', 'consultation fee': 'blue',
  receipt: 'green', payment: 'red', sales: 'blue', purchase: 'orange', contra: 'gray', journal: 'gray',
};

const AVATAR_PALETTE_SIZE = 5;

@Component({
  selector: 'app-common-table-card',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatPaginatorModule, MatSortModule, DragDropModule, PageLoader, PortalDirective],
  templateUrl: './common-table-card.html',
  styleUrl: './common-table-card.scss',
})
export class CommonTableCard {
  private readonly auth = inject(AuthService);

  /**
   * Roles & Permissions action slug per row button, e.g. `{ edit: 'edit-product', delete: 'delete-product' }`.
   * Keys: edit, delete, call, validate, followUp, sendToBranch, viewCallLog, profile, bulkActions,
   * or a quick action key. A button without a slug here (or on the quick action) is always shown.
   */
  @Input() actionPermissions: Record<string, string> = {};

  @Input() title = '';
  @Input() recordCountText = '';
  @Input() columns: TableColumn[] = [];

  /**
   * Columns are sized to their content (table-layout: auto), so no column carries dead whitespace and adding
   * a column just widens the table - the scroll area then scrolls horizontally. This only supplies a floor:
   * the explicit `minWidth`, or enough room for the buttons of an action column (26px each + gaps + padding).
   */
  colMinWidth(col: TableColumn): number | null {
    if (col.minWidth) return col.minWidth;
    const buttons =
      col.type === 'quickActions' && col.menu ? 1
      : col.type === 'quickActions' ? Math.max(0, ...this.rows.map(row => this.asQuickActions(row[col.key]).length))
      : col.type === 'rowActions' ? 2
      : col.type === 'action' ? 3
      : 0;
    return buttons ? buttons * 30 + 24 : null;
  }
  @Input() rows: TableRow[] = [];
  /** Shows a heartbeat loader over the rows while a page of data is (re)loading - the
   *  initial load and every subsequent page/sort/page-size change. */
  @Input() loading = false;
  @Input() bulkActionsLabel?: string;
  @Input() totalRecords = 0;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [10, 30, 50, 100];
  @Input() pageInfoText = '';
  @Input() currentPage = 1;
  @Input() sortActive = '';
  @Input() sortDirection: SortDirection = 'asc';
  @Input() dragDropEnabled = false;
  @Input() dropListId = '';
  @Input() connectedTo: string | string[] = [];
  /** Row `id` to highlight; set it (with `rowSelect`) to turn the table into a master list. */
  @Input() selectedId: string | number | null = null;

  @Output() pageChange = new EventEmitter<TablePageChangeEvent>();
  @Output() sortChange = new EventEmitter<Sort>();
  @Output() rowActionClick = new EventEmitter<TableRow>();
  @Output() bulkActionsClick = new EventEmitter<void>();
  @Output() appointmentClick = new EventEmitter<TableRow>();
  @Output() followUpClick = new EventEmitter<TableRow>();
  @Output() callClick = new EventEmitter<TableRow>();
  @Output() validateClick = new EventEmitter<{ row: TableRow; valid: boolean }>();
  @Output() sendToBranchClick = new EventEmitter<TableRow>();
  @Output() viewCallLogClick = new EventEmitter<TableRow>();
  @Output() editClick = new EventEmitter<TableRow>();
  @Output() deleteClick = new EventEmitter<TableRow>();
  @Output() rowReorder = new EventEmitter<TableReorderEvent>();
  @Output() quickActionClick = new EventEmitter<{ row: TableRow; action: string }>();
  /** Ids of the selected rows (a `select` column); the page owns the selection. */
  @Input() selectedIds: string[] = [];
  /** The new selection after a checkbox changed. */
  @Output() selectionChange = new EventEmitter<string[]>();
  /** A countLink cell was clicked: the row and the column key. */
  @Output() cellClick = new EventEmitter<{ row: TableRow; key: string }>();
  @Output() profileClick = new EventEmitter<TableRow>();
  /**
   * Expandable rows: give the table an `expandedRowTemplate` (context `$implicit` = the row) and an `expand` column. The
   * chevron emits `expandToggle`; the parent owns which rows are open and passes them back in `expandedIds`.
   */
  @Input() expandedRowTemplate: TemplateRef<{ $implicit: TableRow }> | null = null;
  @Input() expandedIds: string[] = [];
  @Output() expandToggle = new EventEmitter<TableRow>();
  /** toggle columns: emitted with the new on/off state; the row value is 'Active' / 'Inactive'. */
  @Output() toggleChange = new EventEmitter<{ row: TableRow; key: string; checked: boolean }>();
  @Output() rowSelect = new EventEmitter<TableRow>();
  @Output() rowTransfer = new EventEmitter<TableTransferEvent>();

  @ViewChild(MatTable) table!: MatTable<TableRow>;

  dragDisabled = true;

  avatarTooltip: { top: number; left: number; name: string, empNo: string } | null = null;

  /** Hover popup for a long text cell (a review of more than 100 words). */
  textTip: { top: number; left: number; text: string } | null = null;
  readonly longWords = 100;

  wordCount(value: unknown): number { return String(value ?? '').trim().split(/\s+/).filter(Boolean).length; }

  /** The first 100 words with an ellipsis, for the cell; the popup shows the rest. */
  clipWords(value: unknown): string { return String(value).trim().split(/\s+/).slice(0, this.longWords).join(' ') + '…'; }

  showText(event: MouseEvent, value: unknown): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const width = 420;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const below = rect.bottom + 8 + 240 < window.innerHeight;
    this.textTip = { left, top: below ? rect.bottom + 8 : Math.max(12, rect.top - 8 - 240), text: String(value) };
  }

  hideText(): void { this.textTip = null; }

  /** Columns to render - an action column with no icon to show (permissions / row state) is left out entirely. */
  get displayedColumns(): string[] {
    const keys = this.columns.filter(column => this.hasVisibleContent(column)).map(column => column.key);
    return this.dragDropEnabled ? ['dragHandle', ...keys] : keys;
  }

  private hasVisibleContent(column: TableColumn): boolean {
    switch (column.type) {
      case 'quickActions':
        return this.rows.some(row => this.asQuickActions(row[column.key]).length > 0);
      case 'rowActions':
        return this.allowed('edit') || this.allowed('delete');
      case 'action':
        return ['call', 'edit', 'followUp', 'sendToBranch', 'delete'].some(key => this.allowed(key))
          || (this.allowed('validate') && this.rows.some(row => !!row['canValidate']));
      case 'callLog':
        return this.allowed('viewCallLog');
      default:
        return true;
    }
  }

  asLeadCell(value: TableRow[string]): LeadCell {
    return value as LeadCell;
  }

  asCallerAvatars(value: TableRow[string]): CallerAvatar[] {
    return Array.isArray(value) ? (value as CallerAvatar[]) : [];
  }

  asCallerLog(value: TableRow[string]): CallerLogEntry[] {
    return Array.isArray(value) ? (value as CallerLogEntry[]) : [];
  }

  /**
   * Quick actions the signed-in role may use (the action's own `permission`, else `actionPermissions[key]`),
   * labelled and iconed as their action is on Roles & Permissions (the page's own label / icon as fallback).
   */
  /** Row whose three-dot menu is open, with the viewport position of its popup. */
  actionMenu: { id: string; top: number; right: number; up: boolean } | null = null;

  toggleActionMenu(event: Event, row: TableRow, count: number): void {
    event.stopPropagation();
    const id = String(row['id']);
    if (this.actionMenu?.id === id) { this.actionMenu = null; return; }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const height = count * 38 + 12;
    const up = rect.bottom + height > window.innerHeight - 8;
    this.actionMenu = { id, up, right: Math.max(8, window.innerWidth - rect.right), top: up ? rect.top - 4 : rect.bottom + 4 };
  }

  runMenuAction(event: Event, row: TableRow, action: string): void {
    event.stopPropagation();
    this.actionMenu = null;
    this.quickActionClick.emit({ row, action });
  }

  /** Popup listing the items behind a countList cell; hover previews it, a click pins it open. */
  listPop: { id: string; label: string; items: string[]; top: number; left: number; pinned: boolean } | null = null;

  isExpanded(row: TableRow): boolean { return this.expandedIds.includes(String(row['id'])); }

  /** Row-def predicate: the detail row exists only when a template was supplied. */
  readonly hasDetail = (): boolean => !!this.expandedRowTemplate;

  isSelected(row: TableRow): boolean { return this.selectedIds.includes(String(row['id'])); }

  /** True when every row on this page is selected. */
  get allSelected(): boolean { return this.rows.length > 0 && this.rows.every(r => this.isSelected(r)); }

  toggleRow(row: TableRow, checked: boolean): void {
    const id = String(row['id']);
    this.selectionChange.emit(checked ? [...new Set([...this.selectedIds, id])] : this.selectedIds.filter(x => x !== id));
  }

  /** Header checkbox: selects or clears the rows on this page, keeping selections made on other pages. */
  toggleAll(checked: boolean): void {
    const page = this.rows.map(r => String(r['id']));
    this.selectionChange.emit(checked ? [...new Set([...this.selectedIds, ...page])] : this.selectedIds.filter(id => !page.includes(id)));
  }

  asProgress(value: TableRow[string]): { value: number; sub?: string } {
    const v = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as { value?: number; sub?: string }) : { value: Number(value) || 0 };
    return { value: Math.max(0, Math.min(100, Math.round(Number(v.value) || 0))), sub: (v as { sub?: string }).sub };
  }

  /** Bar colour band: none, started, nearly done, complete. */
  progressTone(pct: number): string {
    return pct >= 100 ? 'done' : pct >= 50 ? 'mid' : pct > 0 ? 'low' : 'none';
  }

  asList(value: TableRow[string]): string[] {
    return Array.isArray(value) ? (value as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  }

  private openList(event: Event, row: TableRow, col: TableColumn, pinned: boolean): void {
    const items = this.asList(row[col.key]);
    if (!items.length) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const height = Math.min(items.length, 8) * 30 + 44;
    const up = rect.bottom + height > window.innerHeight - 8;
    this.listPop = {
      id: String(row['id']), label: col.header, items, pinned,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 248)),
      top: up ? rect.top - height - 4 : rect.bottom + 4,
    };
  }

  hoverList(event: Event, row: TableRow, col: TableColumn): void {
    if (!this.listPop?.pinned) this.openList(event, row, col, false);
  }

  leaveList(): void {
    if (this.listPop && !this.listPop.pinned) this.listPop = null;
  }

  toggleList(event: Event, row: TableRow, col: TableColumn): void {
    event.stopPropagation();
    if (this.listPop?.pinned && this.listPop.id === String(row['id'])) { this.listPop = null; return; }
    this.openList(event, row, col, true);
  }

  @HostListener('document:click')
  @HostListener('window:resize')
  closeActionMenu(): void { this.actionMenu = null; this.listPop = null; }

  asQuickActions(value: TableRow[string]): QuickAction[] {
    return Array.isArray(value)
      ? (value as QuickAction[])
        .filter(a => this.allowed(a.key, a.permission))
        .map(a => {
          const slug = a.permission ?? this.actionPermissions[a.key];
          return { ...a, label: this.actionName(a.key, a.label, slug), icon: this.actionIcon(a.key, a.icon, slug) };
        })
      : [];
  }

  /** The row button's Action Name from Roles & Permissions, or `fallback` (no action / empty name). */
  actionName(key: string, fallback: string, slug = this.actionPermissions[key]): string {
    return (slug && this.auth.actionDetails(slug)?.action_name?.trim()) || fallback;
  }

  /** The row button's Icon from Roles & Permissions, or `fallback` (no action / empty icon). */
  actionIcon(key: string, fallback: string, slug = this.actionPermissions[key]): string {
    return (slug && this.auth.actionDetails(slug)?.logo?.trim()) || fallback;
  }

  /** Whether a row button is shown: true unless it has an action slug the role is not ticked on. */
  allowed(key: string, slug = this.actionPermissions[key]): boolean {
    return !slug || this.auth.hasActionAccess(slug);
  }

  showAvatarTooltip(event: Event, caller: CallerAvatar): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    this.avatarTooltip = {
      top: rect.top,
      left: rect.left + rect.width / 2,
      name: caller.name,
      empNo: caller.empNo
    };
  }

  hideAvatarTooltip(): void {
    this.avatarTooltip = null;
  }

  onRowClick(event: Event, row: TableRow): void {
    // Buttons and links inside a row (quick actions, name link) have their own behaviour.
    if ((event.target as HTMLElement).closest('button, a')) return;
    this.rowSelect.emit(row);
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  avatarClass(rowIndex: number): string {
    const slot = (rowIndex % AVATAR_PALETTE_SIZE) + 1;
    return `avatar-color-${slot}`;
  }

  avatarColorForName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    const slot = (hash % AVATAR_PALETTE_SIZE) + 1;
    return `avatar-color-${slot}`;
  }

  badgeClass(status: string | number): string {
    const key = String(status).trim().toLowerCase();
    return `badge-${STATUS_MAP[key] ?? 'gray'}`;
  }

  isSortable(column: TableColumn): boolean {
    return column.type !== 'action' && column.type !== 'rowActions' && column.sortable !== false;
  }

  get hasConnections(): boolean {
    return Array.isArray(this.connectedTo) ? this.connectedTo.length > 0 : !!this.connectedTo;
  }

  get dragBoundary(): string {
    return this.hasConnections ? '.cdk-drag-boundary-disabled' : '.table-scroll';
  }

  get dragLockAxis(): DragAxis | null {
    return this.hasConnections ? null : 'y';
  }

  onPaginatorChange(event: PageEvent): void {
    this.pageChange.emit({
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    });
  }

  onHandleMouseDown(): void {
    this.dragDisabled = false;
  }

  drop(event: CdkDragDrop<TableRow[]>) {
    this.dragDisabled = true;

    if (event.previousContainer === event.container) {
      const previousIndex = this.rows.findIndex((d) => d === event.item.data);

      moveItemInArray(this.rows, previousIndex, event.currentIndex);
      this.table.renderRows();

      this.rowReorder.emit({ previousIndex, currentIndex: event.currentIndex, rows: this.rows });
      return;
    }

    this.rowTransfer.emit({
      row: event.item.data,
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
      previousContainerId: event.previousContainer.id,
      currentContainerId: event.container.id,
    });
  }

}
