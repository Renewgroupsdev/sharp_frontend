import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { ActivityLogService } from '../../shared/common-services/activity-log.service';
import { ASSIGNABLE_ROLES, PermAction, PermNode, PermTab, PermissionsService } from '../../shared/common-services/permissions.service';
import { ToastService } from '../../shared/common-services/toast.service';
import { PermContext, PermissionNode } from './permission-node';

const allSlugs = (nodes: PermNode[]): string[] => nodes.flatMap(n => [n.slug, ...allSlugs(n.sub_modules)]);

/**
 * Assign Permissions: pick a role, then tick the modules, sub-modules, tabs and actions it may use. Ticking a module gives
 * the role everything under it; the box shows a dash when only part of the branch is on. Nothing is saved until Save.
 */
@Component({
  selector: 'app-roles-permissions',
  standalone: true,
  imports: [PermissionNode],
  templateUrl: './roles-permissions.html',
  styleUrls: ['../../shared/styles/erp-page.scss', './roles-permissions.scss'],
})
export class RolesPermissions implements OnInit, PermContext {
  private readonly perms = inject(PermissionsService);
  private readonly log = inject(ActivityLogService);
  private readonly toast = inject(ToastService);

  readonly roles = ASSIGNABLE_ROLES;
  readonly selected = signal('mentor');
  readonly nodes = signal<PermNode[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly dirty = signal(false);
  readonly search = signal('');
  private readonly opened = signal<ReadonlySet<string>>(new Set());
  /** Bumped on every change, so the ticks redraw after the tree is edited in place. */
  private readonly version = signal(0);

  readonly roleLabel = computed(() => this.roles.find(r => r.value === this.selected())?.label ?? '');
  readonly searching = computed(() => this.search().trim().length > 0);

  /** How many modules (top level and nested) a role may open, out of all of them. */
  roleStat(role: string): { on: number; total: number } {
    this.version();
    let on = 0, total = 0;
    const walk = (list: PermNode[]) => { for (const n of list) { total++; if (n.roles.includes(role)) on++; walk(n.sub_modules); } };
    walk(this.nodes());
    return { on, total };
  }

  /** What the selected role has switched on, across modules, tabs and actions. */
  readonly summary = computed(() => {
    this.version();
    const role = this.selected();
    const out = { modules: 0, tabs: 0, actions: 0 };
    const walk = (list: PermNode[]) => { for (const n of list) { if (n.roles.includes(role)) out.modules++; out.tabs += n.tabs.filter(t => t.roles.includes(role)).length; out.actions += n.actions.filter(a => a.roles.includes(role)).length; walk(n.sub_modules); } };
    walk(this.nodes());
    return out;
  });

  async ngOnInit(): Promise<void> {
    try {
      this.nodes.set(await this.perms.tree());
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  /* ---------- PermContext: what each tree node reads and does ---------- */

  has = (roles: string[]): boolean => { this.version(); return roles.includes(this.selected()); };

  state = (node: PermNode): 'all' | 'some' | 'none' => {
    this.version();
    const states: boolean[] = [];
    const walk = (n: PermNode) => {
      states.push(this.has(n.roles), ...n.actions.map(a => this.has(a.roles)), ...n.tabs.map(t => this.has(t.roles)));
      n.sub_modules.forEach(walk);
    };
    walk(node);
    return states.every(Boolean) ? 'all' : states.some(Boolean) ? 'some' : 'none';
  };

  isOpen = (slug: string): boolean => this.searching() || this.opened().has(slug);

  toggleOpen = (slug: string): void => this.opened.update(s => { const n = new Set(s); if (!n.delete(slug)) n.add(slug); return n; });

  matches = (node: PermNode): boolean => {
    const q = this.search().trim().toLowerCase();
    if (!q) return true;
    return node.name.toLowerCase().includes(q) || node.slug.toLowerCase().includes(q)
      || node.tabs.some(t => t.name.toLowerCase().includes(q)) || node.actions.some(a => a.name.toLowerCase().includes(q))
      || node.sub_modules.some(c => this.matches(c));
  };

  /** Super Admin keeps Roles & Permissions, so nobody can lock themselves out of this page. */
  locked = (slug: string): boolean => this.selected() === 'super_admin' && (slug === 'a_roles' || slug === 'a_roles.edit');

  private set(roles: string[], on: boolean): string[] {
    const role = this.selected();
    return on ? (roles.includes(role) ? roles : [...roles, role]) : roles.filter(r => r !== role);
  }

  private touch(): void { this.dirty.set(true); this.version.update(v => v + 1); }

  toggleModule = (node: PermNode, on: boolean): void => {
    const cascade = (n: PermNode) => {
      if (on || !this.locked(n.slug)) n.roles = this.set(n.roles, on);
      n.actions.forEach(a => { if (on || !this.locked(a.slug)) a.roles = this.set(a.roles, on); });
      n.tabs.forEach(t => { t.roles = this.set(t.roles, on); });
      n.sub_modules.forEach(cascade);
    };
    cascade(node);
    this.touch();
  };

  /** The modules from the top down to the one that holds this tab or action. */
  private ownerChain(slug: string, nodes: PermNode[] = this.nodes()): PermNode[] {
    for (const n of nodes) {
      if (n.tabs.some(t => t.slug === slug) || n.actions.some(a => a.slug === slug)) return [n];
      const below = this.ownerChain(slug, n.sub_modules);
      if (below.length) return [n, ...below];
    }
    return [];
  }

  /** Giving a role a tab or an action opens the module it sits in, so the menu item shows. */
  private openOwners(slug: string): void {
    for (const n of this.ownerChain(slug)) n.roles = this.set(n.roles, true);
  }

  toggleAction = (action: PermAction, on: boolean): void => { action.roles = this.set(action.roles, on); if (on) this.openOwners(action.slug); this.touch(); };

  toggleTab = (tab: PermTab, on: boolean): void => { tab.roles = this.set(tab.roles, on); if (on) this.openOwners(tab.slug); this.touch(); };

  /* ---------- page actions ---------- */

  expandAll(open: boolean): void { this.opened.set(open ? new Set(allSlugs(this.nodes())) : new Set()); }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      await this.perms.save(this.nodes());
      this.log.record('Roles & Permissions', `Permissions saved (${this.roleLabel()} selected)`);
      this.dirty.set(false);
      this.toast.success('Permissions saved', 'Everyone sees the change the next time their page loads.');
    } catch (e) {
      this.toast.error('Could not save the permissions', apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  async reset(): Promise<void> {
    if (!(await this.toast.confirm('Reset permissions?', 'Every role goes back to the default permissions.', 'Yes, reset'))) return;
    try {
      this.nodes.set(await this.perms.reset());
      this.dirty.set(false);
      this.log.record('Roles & Permissions', 'Permissions reset to defaults');
      this.toast.success('Permissions reset');
    } catch (e) {
      this.toast.error('Could not reset', apiErrorMessage(e));
    }
  }
}
