import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from './toast.service';
import { UsersService } from './users.service';

/** Account actions with their guards, confirmations and toasts; shared by the user list and the user profile dialog. */
@Injectable({ providedIn: 'root' })
export class UserActionsService {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Suspends (after confirming) or re-activates the account. */
  async toggleStatus(id: string): Promise<boolean> {
    const u = this.users.get(id);
    if (!u || this.isSelf(u.id, 'suspend')) return false;
    const next = u.st === 'Suspended' ? 'Active' : 'Suspended';
    if (next === 'Suspended' && !(await this.toast.confirm('Suspend user?', `${u.n} will no longer be able to sign in until re-activated.`, 'Yes, suspend'))) return false;
    try { await this.users.setStatus(id, next); } catch (e) { return this.fail('Could not update user', (e as Error).message); }
    this.toast.success(next === 'Active' ? 'User reinstated' : 'User suspended');
    return true;
  }

  async remove(id: string): Promise<boolean> {
    const u = this.users.get(id);
    if (!u || this.isSelf(u.id, 'delete')) return false;
    const blocker = this.users.deleteBlocker(u);
    if (blocker) return this.fail('Cannot delete user', blocker);
    if (!(await this.toast.confirm('Delete user?', `Remove ${u.n} (${u.id}). This cannot be undone.`))) return false;
    try { await this.users.deleteUser(id); } catch (e) { return this.fail('Could not delete user', (e as Error).message); }
    this.toast.success('User deleted');
    return true;
  }

  resendInvite(id: string): void {
    const u = this.users.get(id);
    if (!u) return;
    if (!u.ph || !/\d{10}/.test(u.ph)) return void this.toast.error('No mobile number on this account');
    const invite = this.users.resendInvite(id);
    if (!invite) return void this.toast.error('No valid mobile number on this account');
    window.open(invite.url, '_blank', 'noopener');
    this.toast.success('WhatsApp invite opened', `Press send in WhatsApp to deliver it to ${u.ph}`);
  }

  /** Confirms, issues a new temporary password and shows it once; the user must set their own at next sign-in. */
  async resetPassword(id: string): Promise<boolean> {
    const u = this.users.get(id);
    if (!u || this.isSelf(u.id, 'reset the password of')) return false;
    if (!(await this.toast.confirm('Reset password?', `${u.n} will be signed out and must use a new temporary password.`, 'Yes, reset'))) return false;
    let pw: string | null;
    try { pw = await this.users.resetPassword(id); } catch (e) { return this.fail('Could not reset password', (e as Error).message); }
    if (!pw) return false;
    await this.toast.secret('Temporary password issued', "Shown once. They'll set their own again at next sign-in.", 'Temporary password', pw);
    return true;
  }

  changeBatch(id: string, batch: string): void {
    this.users.changeBatch(id, batch);
    this.toast.success('Batch updated', batch);
  }

  private isSelf(id: string, verb: string): boolean {
    return id === this.auth.actor().id && this.fail(`You cannot ${verb} your own account`);
  }

  /** Shows the error and reports "did not happen". */
  private fail(title: string, text?: string): false {
    this.toast.error(title, text);
    return false;
  }
}
