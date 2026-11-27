import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { NavLink, navForShell } from '../core/nav/nav-config';
import { ChatDockService } from '../shared/common-services/chat-dock.service';
import { NavLayoutService } from '../services/nav-layout.service';

/** Role-aware sidebar: the admin workspace shows only modules the role may view; Mentor and Student have their own menus. */
@Component({
  selector: 'app-left-side-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './left-side-navbar.html',
  styleUrl: './left-side-navbar.scss',
})
export class LeftSideNavbar {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly navLayout = inject(NavLayoutService);
  private readonly dock = inject(ChatDockService);

  /** The number shown beside a menu item: unread chat messages on SHARP Community. */
  protected badge(link: NavLink): number {
    return link.path === '/app/community' ? this.dock.totalUnread() : 0;
  }

  readonly links = computed<NavLink[]>(() => navForShell(this.auth.shell(), this.auth.role(), key => this.auth.can(key, 'v')));

  isActive(link: NavLink): boolean {
    const url = this.router.url.split('?')[0];
    // Sub-menu entries match exactly (so "Courses" is not lit on /courses/quiz); a parent is lit by itself or any child.
    if (this.isChild(link)) return url === link.path;
    return url === link.path || url.startsWith(link.path + '/') || (link.children ?? []).some(c => url === c.path);
  }

  private isChild(link: NavLink): boolean {
    return this.links().some(l => l.children?.includes(link));
  }

  onNavigate(): void {
    this.navLayout.closeMobileSidebar();
  }
}
