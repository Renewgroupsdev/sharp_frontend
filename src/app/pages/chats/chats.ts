import { Component } from '@angular/core';
import { ChatLauncher } from '../../shared/components/chat-launcher/chat-launcher';

/**
 * SHARP Community for students and mentors: all their chats and discussions live in the chat drawer, opened from here.
 * A role with the "Student Chats" permission (a mentor) also gets a tab with the personal chats of their assigned students.
 */
@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [ChatLauncher],
  template: `
    <div class="purchase-page container-fluid px-0">
      <div class="page-header">
        <h6 class="page-title"><i class="bi bi-chat-dots"></i> SHARP Community</h6>
        <p class="page-subtitle">Common Floor, your course and group discussions, announcements, all in one place.</p>
      </div>

      <div class="launch"><app-chat-launcher scope="all" icon="bi-chat-dots" text="Your conversations open in the chat drawer on the right." label="Open SHARP Community" /></div>
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
export class Chats {}
