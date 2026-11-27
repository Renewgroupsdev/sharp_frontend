import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { CommunityService } from '../../shared/common-services/community.service';
import { ToastService } from '../../shared/common-services/toast.service';
import { CanActionDirective } from '../../shared/directives/can-action.directive';
import { DmList } from './dm-list/dm-list';
import { GroupList } from './group-list/group-list';

type Tab = 'Chat' | 'Announcement' | 'dm';

/**
 * SHARP Community (admin): chat groups, announcement groups, personal messages and every personal chat.
 * Groups, people and messages all come from the API; the Common Floor chat is the same one the mobile app uses.
 */
@Component({
  selector: 'app-community',
  standalone: true,
  imports: [GroupList, DmList, CanActionDirective],
  templateUrl: './community.html',
  styleUrls: ['../../shared/styles/erp-page.scss', '../assessments/assessments.scss', './community.scss'],
})
export class Community implements OnInit {
  protected readonly store = inject(CommunityService);
  private readonly toast = inject(ToastService);

  protected readonly tab = signal<Tab>('Chat');
  private readonly chatList = viewChild(GroupList);
  private readonly dmList = viewChild(DmList);

  ngOnInit(): void {
    this.store.refreshAll().catch(e => this.toast.error('Could not load the community', apiErrorMessage(e)));
  }

  protected createGroup(): void {
    this.chatList()?.create();
  }

  protected newMessage(): void {
    this.dmList()?.compose();
  }
}
