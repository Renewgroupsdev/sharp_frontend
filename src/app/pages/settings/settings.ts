import { Component, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { NavLayoutService, PrimaryColor, ThemeMode } from '../../services/nav-layout.service';
import { ToastService } from '../../shared/common-services/toast.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: './settings.html',
  styleUrls: ['../../shared/styles/erp-page.scss', './settings.scss'],
})
export class Settings {
  private readonly toast = inject(ToastService);
  readonly nav = inject(NavLayoutService);
  readonly auth = inject(AuthService);

  readonly themes: { value: ThemeMode; label: string }[] = [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }];
  readonly colors: { value: Exclude<PrimaryColor, 'custom'>; hex: string }[] = [
    { value: 'renew', hex: '#0369a1' }, { value: 'green', hex: '#18b875' }, { value: 'blue', hex: '#2d7ff9' },
    { value: 'purple', hex: '#8b5cf6' }, { value: 'teal', hex: '#0f9f91' },
  ];

  customColor(event: Event): void {
    this.nav.setCustomPrimaryColor((event.target as HTMLInputElement).value);
  }

  async resetDemoData(): Promise<void> {
    if (!(await this.toast.confirm('Reset demo data?', 'All records, permissions and logs return to the sample data and the page reloads.', 'Yes, reset'))) return;
    try {
      Object.keys(localStorage).filter(k => k.startsWith(environment.storagePrefix) && !['token', 'user'].includes(k.slice(environment.storagePrefix.length))).forEach(k => localStorage.removeItem(k));
    } catch { /* storage blocked */ }
    location.reload();
  }
}
