import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { UserForm } from '../../pages/users/user-form/user-form';
import { UserView } from '../../pages/users/user-view/user-view';

/**
 * Opens a person's details from any module: click a name in a list and the same panel as User Management opens. What the
 * panel shows (its tabs, the edit button) follows the role's permissions, and the data follows the role's scope.
 */
@Injectable({ providedIn: 'root' })
export class UserDetailService {
  private readonly dialog = inject(MatDialog);

  /**
   * `userId` is the person's public id (e.g. SH2026/FCM/0412). `focus` is the module the click came from: the panel then
   * shows Details and only that module's tab. Leave it out (User Management) to show every tab.
   */
  open(userId: string, focus?: 'learning' | 'attendance' | 'certificates'): void {
    const base = { maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', autoFocus: false, restoreFocus: true } as const;
    this.dialog.open<UserView, { userId: string; focus?: string }, 'edit' | undefined>(UserView, { ...base, width: '760px', data: { userId, focus } })
      .afterClosed().subscribe(r => {
        if (r === 'edit') this.dialog.open(UserForm, { ...base, width: '860px', data: { userId } });
      });
  }
}
