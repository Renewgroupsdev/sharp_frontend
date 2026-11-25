import { Injectable, effect, inject } from '@angular/core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { CommunityMessage } from '../models/community.model';
import { LiveNotification } from '../models/notification.model';

/** Public ids contain characters a channel name cannot (SH2026/THC/0413), so the API names a person's channels by the id in hex. */
const hexOf = (id: string): string => Array.from(new TextEncoder().encode(id), b => b.toString(16).padStart(2, '0')).join('');

type Handlers = {
  posted?: (m: CommunityMessage) => void;
  removed?: (messageId: number) => void;
};

/**
 * Live chat over WebSockets (Laravel Reverb, Pusher protocol). One shared connection, opened on first use with the same
 * bearer token as the API and closed when the person signs out. Private channels are authorised by the API, so a person can
 * only listen to groups they may read.
 *
 * Chat never depends on it: if the socket server is down, nothing here throws and the screens keep their slow refresh.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private echo: Echo<'reverb'> | null = null;

  constructor() {
    effect(() => {
      if (!this.auth.isAuthenticated()) this.disconnect();
    });
  }

  /** Whether a socket server is configured at all (it is not in a build that has no `realtime.key`). */
  get enabled(): boolean { return !!environment.realtime.key; }

  /** Live messages of one group. Returns the function that stops listening. */
  listenGroup(groupId: number, handlers: Handlers): () => void {
    const channel = this.connect()?.private(`community.group.${groupId}`);
    if (!channel) return () => undefined;
    const posted = (e: { message: CommunityMessage }) => handlers.posted?.(e.message);
    const removed = (e: { message_id: number }) => handlers.removed?.(e.message_id);
    if (handlers.posted) channel.listen('.message.posted', posted);
    if (handlers.removed) channel.listen('.message.removed', removed);
    return () => {
      if (handlers.posted) channel.stopListening('.message.posted', posted);
      if (handlers.removed) channel.stopListening('.message.removed', removed);
    };
  }

  /** A new notification for the signed-in person, pushed the moment it is stored. */
  listenNotifications(userId: string, onNotification: (n: LiveNotification) => void): () => void {
    const channel = this.connect()?.private(`notifications.${hexOf(userId)}`);
    if (!channel) return () => undefined;
    channel.listen('.notification.created', onNotification);
    return () => channel.stopListening('.notification.created', onNotification);
  }

  /** The signed-in person's chat list changed (a personal chat started, added to or removed from a group). */
  listenChats(userId: string, onChange: () => void): () => void {
    const channel = this.connect()?.private(`community.user.${hexOf(userId)}`);
    if (!channel) return () => undefined;
    channel.listen('.community.changed', onChange);
    return () => channel.stopListening('.community.changed', onChange);
  }

  private connect(): Echo<'reverb'> | null {
    if (this.echo) return this.echo;
    const cfg = environment.realtime;
    const token = this.auth.accessToken();
    if (!cfg.key || !token) return null;
    try {
      (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;
      this.echo = new Echo({
        broadcaster: 'reverb',
        key: cfg.key,
        wsHost: cfg.host || window.location.hostname,
        wsPort: cfg.port,
        wssPort: cfg.port,
        forceTLS: cfg.secure,
        enabledTransports: ['ws', 'wss'],
        authEndpoint: cfg.authEndpoint,
        auth: { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      });
    } catch {
      this.echo = null;
    }
    return this.echo;
  }

  private disconnect(): void {
    try { this.echo?.disconnect(); } catch { /* already closed */ }
    this.echo = null;
  }
}
