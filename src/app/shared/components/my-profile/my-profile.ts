import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ToastService } from '../../common-services/toast.service';
import { UsersApi } from '../../common-services/users-api.service';
import { generatePassword } from '../../utils/password.util';
import { UsersService } from '../../common-services/users.service';

const MAX_PIC = 300 * 1024;

/**
 * Edit my profile, for every role: picture, name, phone, email, short description and biography; and change my password.
 * Username, role, institute and batch are shown but only an administrator changes them.
 */
@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './my-profile.html',
  styleUrls: ['../../styles/erp-dialog.scss', './my-profile.scss'],
})
export class MyProfile {
  private readonly ref = inject(MatDialogRef<MyProfile>);
  private readonly api = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);

  protected readonly me = computed(() => this.auth.actor());
  protected readonly tab = signal<'profile' | 'password'>('profile');
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly serverError = signal<string | null>(null);

  private readonly start = this.me();
  protected model = {
    name: this.start.n,
    mobile: this.start.ph ?? '',
    email: this.start.email ?? '',
    shortDescription: this.start.sd ?? '',
    biography: this.start.bio ?? '',
    avatar: null as string | null,
    removeAvatar: false,
  };
  protected readonly preview = signal<string | null>(this.start.pic ?? null);
  protected readonly loading = signal(true);

  constructor() {
    // Fill the form from the server's copy of my account, so it never shows stale or empty details.
    this.api.me().then(res => {
      const u = res.user;
      this.model.name = u.name;
      this.model.mobile = u.mobile ?? '';
      this.model.email = u.email ?? '';
      this.model.shortDescription = u.short_description ?? '';
      this.model.biography = u.biography ?? '';
      this.preview.set(u.avatar ?? null);
      this.account.set({ username: u.username ?? '', org: u.org ?? '', batch: u.batch ?? '', role: this.me().r });
    }).catch(() => undefined).finally(() => this.loading.set(false));
  }

  /** The read-only facts of my account, from the server. */
  protected readonly account = signal<{ username: string; org: string; batch: string; role: string }>({ username: this.start.username ?? '', org: this.start.org, batch: this.start.b, role: this.start.r });
  protected pwd = { current: '', next: '', again: '' };
  protected readonly show = signal(false);

  /** Fills both new-password boxes with a strong random password and reveals it so it can be noted down. */
  protected generate(): void {
    this.pwd.next = this.pwd.again = generatePassword();
    this.show.set(true);
  }

  protected async copyPassword(): Promise<void> {
    try { await navigator.clipboard.writeText(this.pwd.next); this.toast.success('Password copied'); } catch { /* clipboard blocked */ }
  }

  /** A rough strength for the new password: length, upper and lower case, digits and symbols. */
  protected strength(): { level: number; label: string } {
    const p = this.pwd.next;
    if (!p) return { level: 0, label: 'Enter a new password' };
    const score = [p.length >= 8, p.length >= 12, /[a-z]/.test(p) && /[A-Z]/.test(p), /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
    return { level: Math.max(1, score), label: ['', 'Weak', 'Fair', 'Good', 'Strong'][Math.max(1, score)] };
  }

  protected onPicture(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > MAX_PIC) {
      this.serverError.set('The picture must be a PNG, JPEG or WebP image under 300 KB.');
      input.value = '';
      return;
    }
    this.serverError.set(null);
    const reader = new FileReader();
    reader.onload = () => { this.model.avatar = String(reader.result); this.model.removeAvatar = false; this.preview.set(this.model.avatar); };
    reader.readAsDataURL(file);
  }

  protected removePicture(): void {
    this.model.avatar = null;
    this.model.removeAvatar = true;
    this.preview.set(null);
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    const m = this.model;
    if (!m.name.trim() || this.saving()) return;
    this.saving.set(true);
    try {
      const res = await this.api.updateMe({
        name: m.name.trim(), mobile: m.mobile.trim() || null, email: m.email.trim() || null,
        short_description: m.shortDescription.trim() || null, biography: m.biography.trim() || null,
        ...(m.avatar ? { avatar: m.avatar } : {}), ...(m.removeAvatar ? { avatar_remove: true } : {}),
      });
      this.auth.applyProfile({ name: res.user.name, initials: res.user.initials });
      this.toast.success('Profile updated');
      this.ref.close(true);
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected async changePassword(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    const p = this.pwd;
    if (!p.current || p.next.length < 8) return void this.serverError.set('Enter your current password and a new one of at least 8 characters.');
    if (p.next !== p.again) return void this.serverError.set('The new password and its confirmation do not match.');
    this.saving.set(true);
    try {
      await this.api.changePassword({ current_password: p.current, new_password: p.next });
      this.toast.success('Password changed');
      this.pwd = { current: '', next: '', again: '' };
      this.submitted.set(false);
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected close(): void { this.ref.close(false); }
}
