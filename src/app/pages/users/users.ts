import { Component, computed, inject } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { ROLES, SharpUser } from '../../core/data/models';
import { InstitutesService } from '../../shared/common-services/institutes.service';
import { EnumsService } from '../../shared/common-services/enums.service';
import { ToastService } from '../../shared/common-services/toast.service';
import { UserActionsService } from '../../shared/common-services/user-actions.service';
import { UsersService } from '../../shared/common-services/users.service';
import { CommonFilterCard } from '../../shared/components/common-filter-card/common-filter-card';
import { CountRibbon } from '../../shared/components/count-ribbon/count-ribbon';
import { CommonTableCard } from '../../shared/components/common-table-card/common-table-card';
import { LocalListBase } from '../../shared/components/local-list-base';
import { CanActionDirective } from '../../shared/directives/can-action.directive';
import { ExportFormat, RibbonItem, QuickAction, TableColumn, TableRow } from '../../shared/models/common-components.model';
import { BulkUpload } from './bulk-upload/bulk-upload';
import { UserForm } from './user-form/user-form';
import { UserView } from './user-view/user-view';


const FORM_WIDTH = '860px';

const COLUMNS: TableColumn[] = [
  { key: 'user', header: 'User', type: 'lead', width: '22%', minWidth: 200 },
  { key: 'role', header: 'Role', width: '10%' },
  { key: 'org', header: 'Organization / institute', width: '20%' },
  { key: 'batch', header: 'Batch', width: '12%' },
  { key: 'status', header: 'Status', type: 'badge', width: '9%' },
  { key: 'last', header: 'Last sign-in', width: '12%' },
  { key: 'actions', header: 'Actions', type: 'quickActions', width: '10%', minWidth: 190, sortable: false },
];

const action = (key: string, icon: string, label: string, permission: string, variant?: QuickAction['variant']): QuickAction => ({ key, icon, label, permission, variant });

/** Quick actions for one account; the status action reads "Suspend" / "Reinstate", and invites can be resent while still pending. */
function actionsFor(u: SharpUser): QuickAction[] {
  const suspended = u.st === 'Suspended';
  return [
    action('view', 'bi-eye-fill', 'View user', 'a_users.view'),
    action('edit', 'bi-pencil-square', 'Edit user', 'a_users.edit', 'primary'),
    ...(u.st === 'Invited' ? [action('invite', 'bi-send-fill', 'Resend invite', 'a_users.edit')] : []),
    action('password', 'bi-key-fill', 'Reset password', 'a_users.edit'),
    action('toggle', suspended ? 'bi-person-check-fill' : 'bi-person-slash', suspended ? 'Reinstate' : 'Suspend', 'a_users.edit'),
    action('delete', 'bi-trash3-fill', 'Delete user', 'a_users.delete', 'danger'),
  ];
}

/** User Management: the user list (search, filter, add / edit / suspend / delete, bulk upload) and the role access guide. */
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [MatDialogModule, CommonFilterCard, CountRibbon, CommonTableCard, CanActionDirective],
  templateUrl: './users.html',
  styleUrls: ['../../shared/styles/erp-page.scss'],
})
export class Users extends LocalListBase {
  private readonly store = inject(UsersService);
  private readonly institutes = inject(InstitutesService);
  private readonly actions = inject(UserActionsService);
  private readonly toast = inject(ToastService);
  private readonly enums = inject(EnumsService);

  constructor() {
    super();
    void this.store.refresh().then(err => { if (err) this.toast.error('Could not load users', err); });
  }

  protected readonly noun = 'users';
  protected override filterFields = { status: 'status', source: 'role', branch: ['org'] };

  override columns = COLUMNS;
  override filters = [
    { key: 'status', label: 'Status', options: this.enums.userStatuses() },
    { key: 'source', label: 'Role', options: this.roleOptions() },
    { key: 'branch', label: 'Institute', options: this.institutes.names(), multiSelect: true },
  ];

  readonly searchPlaceholder = 'Search by name, ID, username, email or mobile...';

  /** Per-role headcount, computed once per store change and shared by the stat cards and the role guide. */
  private readonly roleCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const u of this.store.items()) counts.set(u.r, (counts.get(u.r) ?? 0) + 1);
    return counts;
  });

  /** One ribbon item per role (no all-users total); hovering lists that role's users. */
  readonly stats = computed<RibbonItem[]>(() => {
    const items = this.store.items();
    return ROLES.map(r => {
      const users = items.filter(u => u.r === r);
      return { key: r, label: r, value: users.length, filter: { key: 'source' as const, value: r }, hoverItems: users.map(u => ({ name: u.n, sub: u.id })) };
    });
  });

  /** Handlers for the table's quick actions, keyed by `QuickAction.key`. */
  private readonly handlers: Record<string, (row: TableRow, id: string) => unknown> = {
    view: row => this.open(row),
    edit: (_, id) => this.editUser(id),
    invite: (_, id) => this.actions.resendInvite(id),
    password: (_, id) => this.actions.resetPassword(id),
    toggle: (_, id) => this.actions.toggleStatus(id),
    delete: (_, id) => this.actions.remove(id),
  };

  /** Roles to filter by; "Trainer" is offered only when such accounts exist. */
  private roleOptions(): string[] {
    return [...this.enums.roles(), ...(this.store.items().some(u => u.r === 'Trainer') ? ['Trainer'] : [])];
  }

  protected allRows(): TableRow[] {
    return this.store.items().map(u => this.row(u));
  }

  private row(u: SharpUser): TableRow {
    return {
      id: u.id,
      user: { name: u.n, subtitle: u.id + (u.username ? ` · @${u.username}` : ''), photo: u.pic ?? '' },
      __user: u.n,
      searchText: [u.n, u.id, u.username, u.email, u.ph].filter(Boolean).join(' '),
      role: u.r,
      org: u.org || '—',
      batch: u.b || '—',
      status: u.st || 'Active',
      last: u.last || 'Never signed in',
      actions: actionsFor(u),
    };
  }


  addUser(): void { this.openDialog(UserForm, {}, FORM_WIDTH); }
  bulkUpload(): void { this.openDialog(BulkUpload, {}, '900px'); }
  editUser(userId: string): void { this.openDialog(UserForm, { userId }, FORM_WIDTH); }

  /** Profile dialog; its Edit button hands over to the edit form. */
  open(row: TableRow): void {
    const userId = String(row['id']);
    this.openDialog<UserView, 'edit' | undefined>(UserView, { userId }, '760px')
      .afterClosed().subscribe(r => { if (r === 'edit') this.editUser(userId); });
  }

  onQuickAction(event: { row: TableRow; action: string }): void {
    this.handlers[event.action]?.(event.row, String(event.row['id']));
  }

  onExport(format: ExportFormat): void {
    this.exportAs(format, 'sharp-users', 'Users');
  }
}
