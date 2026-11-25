import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavbar } from '../top-navbar/top-navbar';
import { LeftSideNavbar } from '../left-side-navbar/left-side-navbar';
import { ChatDock } from '../shared/components/chat-dock/chat-dock';
import { NotificationToasts } from '../shared/components/notification-toasts/notification-toasts';
import { NavLayoutService } from '../services/nav-layout.service';

/** Signed-in shell: header with the "View as" role switch, role-aware sidebar and the routed page. */
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, TopNavbar, LeftSideNavbar, ChatDock, NotificationToasts],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  /** Injected so the saved theme / primary colour is applied as soon as the shell loads. */
  protected readonly navLayout = inject(NavLayoutService);
}
