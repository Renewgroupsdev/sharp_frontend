import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { UsersApi } from '../../shared/common-services/users-api.service';
import { generatePassword } from '../../shared/utils/password.util';

/**
 * Shown right after a first sign-in (or an admin's password reset): the account must set its own password before
 * anything else. On success the session ends and the person signs in again with the new password.
 */
@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss',
})
export class ChangePassword {
  private readonly auth = inject(AuthService);
  private readonly api = inject(UsersApi);
  private readonly router = inject(Router);

  protected readonly name = this.auth.displayName();
  protected next = '';
  protected again = '';
  protected readonly show = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly copied = signal(false);

  protected generate(): void {
    this.next = this.again = generatePassword();
    this.show.set(true);
    this.copied.set(false);
  }

  protected async copy(): Promise<void> {
    try { await navigator.clipboard.writeText(this.next); this.copied.set(true); } catch { /* clipboard blocked */ }
  }

  protected async submit(): Promise<void> {
    this.error.set('');
    if (this.next.length < 8) return void this.error.set('The new password must be at least 8 characters.');
    if (this.next !== this.again) return void this.error.set('The two passwords do not match.');
    this.busy.set(true);
    try {
      await this.api.changePassword({ current_password: '', new_password: this.next });
      this.auth.logout('/login?changed=1');
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected signOut(): void { this.auth.logout(); }
}
