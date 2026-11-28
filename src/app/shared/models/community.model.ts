/** Roles that sit in every group (except personal chats) and can read every conversation. */
export const COMMUNITY_OVERSIGHT_ROLES = ['Super Admin', 'Admin', 'OB'];

export type GroupKind = 'Chat' | 'Announcement';
export type GroupSource = 'floor' | 'course' | 'custom' | 'dm';

/** One group, as GET /community/groups returns it (counts and `can_post` are worked out for the signed-in user). */
export interface CommunityGroup {
  id: number;
  /** What to show: the name, or "A ↔ B" for a personal chat. */
  title: string;
  name: string | null;
  kind: GroupKind;
  source: GroupSource;
  course_id: number | null;
  created_by: string | null;
  members_total: number;
  messages_total: number;
  last_message: { at: string; by: string | null } | null;
  can_post: boolean;
  /** Per person: pinned to the top of their chat list, and how many messages they have not read. */
  pinned: boolean;
  pinned_at: string | null;
  unread: number;
  /** The two people of a personal chat. */
  participants: { user_id: string; name: string }[] | null;
  created_at: string;
}

export interface CommunityMember {
  user_id: string;
  name: string;
  role: string;
  org: string | null;
  initials: string | null;
  color: string | null;
  online: boolean;
  /** When the person last used the app, or null if they never signed in. */
  last_seen_at: string | null;
  /** Added by hand, so it can be taken out; people in through enrolment or staff roles cannot. */
  removable: boolean;
}

export interface MessageAuthor {
  user_id: string;
  name: string;
  role: string;
  initials: string | null;
  color: string | null;
}

export interface CommunityMessage {
  id: number;
  group_id: number;
  /** The group's title; used when messages of several groups are listed together. */
  group: string;
  body: string;
  at: string;
  author: MessageAuthor | null;
  /** One image or document sent with the message. */
  attachment?: { name: string; mime: string; size: number } | null;
}

export interface CommunityOverview {
  chat: { groups: number; course: number; custom: number };
  announcement: { groups: number; course: number; custom: number };
  personal_chats: number;
  users_total: number;
  users_online: number;
  online_window_minutes: number;
}

export interface CommunityPerson {
  user_id: string;
  name: string;
  role: string;
  org: string | null;
  initials: string | null;
  color: string | null;
  online: boolean;
  last_login: string | null;
}

export interface CommunityGroupBody { name: string; kind: GroupKind; members: string[] }

/** What to call a group in a list: its title, or the other person for a personal chat. */
export const groupLabel = (g: CommunityGroup, myId: string): string =>
  g.source === 'dm' ? (g.participants?.find(p => p.user_id !== myId)?.name ?? g.title) : g.title;

/** "online", or how long ago the person was last seen: "last seen 5 min ago", "last seen 3 h ago", "last seen 12 Nov". */
export const presenceLabel = (m: { online: boolean; last_seen_at: string | null }): string => {
  if (m.online) return 'online';
  if (!m.last_seen_at) return 'never signed in';
  const t = new Date(m.last_seen_at).getTime();
  if (isNaN(t)) return 'offline';
  const min = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (min < 60) return `last seen ${min} min ago`;
  if (min < 60 * 24) return `last seen ${Math.round(min / 60)} h ago`;
  return `last seen ${new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
};
