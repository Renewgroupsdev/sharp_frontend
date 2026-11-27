import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ChatLauncher } from '../../shared/components/chat-launcher/chat-launcher';
import { DmList } from '../community/dm-list/dm-list';

/**
 * SHARP Community for students and mentors: all their chats and discussions live in the chat drawer, opened from here.
 * A role with the "Student Chats" permission (a mentor) also gets a tab with the personal chats of their assigned students.
 */
@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [ChatLauncher, DmList],
  template: `
    <div class="purchase-page container-fluid px-0">
      <div class="page-header">
        <h6 class="page-title"><i class="bi bi-chat-dots"></i> SHARP Community</h6>
        <p class="page-subtitle">Common Floor, your course and group discussions, announcements and personal messages, all in one place.</p>
      </div>

      @if (canSeeStudentChats()) {
        <div class="tabs" role="tablist">
          <button type="button" role="tab" [class.active]="tab() === 'mine'" [attr.aria-selected]="tab() === 'mine'" (click)="tab.set('mine')"><i class="bi bi-chat-dots"></i> My conversations</button>
          <button type="button" role="tab" [class.active]="tab() === 'students'" [attr.aria-selected]="tab() === 'students'" (click)="tab.set('students')"><i class="bi bi-chat-left-text"></i> Student chats</button>
        </div>
      }

      @if (tab() === 'students' && canSeeStudentChats()) {
        <app-dm-list class="dm" [embedded]="true" />
      } @else {
        <div class="launch"><app-chat-launcher scope="all" icon="bi-chat-dots" text="Your conversations open in the chat drawer on the right." label="Open SHARP Community" /></div>
      }
    </div>
  `,
  styleUrls: ['../../shared/styles/erp-page.scss'],
  styles: `
    .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-soft, #e5e7eb); }
    .tabs button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: 0; border-bottom: 2px solid transparent; background: none; font: inherit; font-size: 13px; font-weight: 600; color: #667085; cursor: pointer; }
    .tabs button.active { border-bottom-color: #080536; color: #080536; }
    .dm { flex: 1 1 auto; min-height: 0; }
    .launch { padding: 8px 2px; }
  `,
})
export class Chats {
  private readonly auth = inject(AuthService);

  protected readonly tab = signal<'mine' | 'students'>('mine');
  /** Needs View on the Student Chats permission (Roles & Permissions); students never have it. */
  protected readonly canSeeStudentChats = computed(() => this.auth.role() !== 'Student' && this.auth.can('a_dmchat', 'v'));
}
