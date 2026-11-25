import { Component, inject } from '@angular/core';
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
}
