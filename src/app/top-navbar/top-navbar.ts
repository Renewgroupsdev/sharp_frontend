import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MyProfile } from '../shared/components/my-profile/my-profile';
import { AuthService } from '../core/auth/auth.service';
import { NavLayoutService } from '../services/nav-layout.service';
import { NotificationBell } from '../shared/components/notification-bell/notification-bell';

/** Brand bar: SHARP title, the signed-in account. */
@Component({
  selector: 'app-top-navbar',
  standalone: true,
  imports: [NotificationBell],
  templateUrl: './top-navbar.html',
  styleUrl: './top-navbar.scss',
})
export class TopNavbar {
  protected readonly auth = inject(AuthService);
  protected readonly nav = inject(NavLayoutService);
  private readonly dialog = inject(MatDialog);

  /** Everyone, whatever their role, can edit their own profile. */
  openProfile(): void {
    this.dialog.open(MyProfile, { width: '640px', maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', autoFocus: false, restoreFocus: true });
  }
}
