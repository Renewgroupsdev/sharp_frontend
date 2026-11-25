import { Component } from '@angular/core';
import { ChatLauncher } from '../../shared/components/chat-launcher/chat-launcher';

/** SHARP Community for students and mentors: all their chats and discussions live in the chat drawer, opened from here. */
@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [ChatLauncher],
  template: `
    <section class="chats-page">
      <h2 class="page-title"><i class="bi bi-chat-dots"></i> SHARP Community</h2>
      <p class="sub">Common Floor, your course and group discussions, announcements and personal messages, all in one place.</p>
      <app-chat-launcher scope="all" icon="bi-chat-dots" text="Your conversations open in the chat drawer on the right." label="Open SHARP Community" />
    </section>
  `,
  styles: `.chats-page { padding: 20px; max-width: 760px; } .sub { margin: 0 0 18px; color: var(--text-muted, #6b7280); font-size: 13.5px; }`,
})
export class Chats {}
