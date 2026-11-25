import { Component, computed, inject, signal } from '@angular/core';
import { ADMIN_MODULES, ROLES, ROLE_ACCESS, Role } from '../../core/data/models';
import { ActivityLogService } from '../../shared/common-services/activity-log.service';
import { PermissionsService } from '../../shared/common-services/permissions.service';
import { ToastService } from '../../shared/common-services/toast.service';

type Letter = 'v' | 'c' | 'u' | 'd';

@Component({
  selector: 'app-roles-permissions',
  standalone: true,
  templateUrl: './roles-permissions.html',
  styleUrls: ['../../shared/styles/erp-page.scss', './roles-permissions.scss'],
})
export class RolesPermissions {
  private readonly perms = inject(PermissionsService);
  private readonly log = inject(ActivityLogService);
  private readonly toast = inject(ToastService);

  readonly roles = ROLES;
  readonly modules = ADMIN_MODULES;
  readonly actions: { letter: Letter; label: string }[] = [
    { letter: 'v', label: 'View' }, { letter: 'c', label: 'Create' }, { letter: 'u', label: 'Edit' }, { letter: 'd', label: 'Delete' },
  ];

  readonly selected = signal<Role>('Mentor');
  readonly locked = computed(() => this.selected() === 'Super Admin');
  readonly description = computed(() => ROLE_ACCESS[this.selected()]);

  has(moduleKey: string, letter: Letter): boolean {
    return this.perms.has(this.selected(), moduleKey, letter);
  }

  toggle(moduleKey: string, label: string, letter: Letter): void {
    if (this.locked()) return;
    const on = this.has(moduleKey, letter);
    this.perms.toggle(this.selected(), moduleKey, letter);
    const mod = ADMIN_MODULES.find(m => m.key === moduleKey)?.label ?? moduleKey;
    this.log.record('Roles & Permissions', `${this.selected()} · ${mod} · ${label} ${on ? 'revoked' : 'granted'}`);
  }

  async reset(): Promise<void> {
    if (!(await this.toast.confirm('Reset permissions?', 'All roles go back to the default permissions.', 'Yes, reset'))) return;
    this.perms.resetDefaults();
    this.log.record('Roles & Permissions', 'Permissions reset to defaults');
    this.toast.success('Permissions reset');
  }
}
