/** One rule of Notification Management, as GET /notification-rules returns it. The event itself is fixed by the app. */
export interface NotificationRule {
  /** Event key, e.g. `certificate_issued`. */
  event: string;
  label: string;
  /** Who gets it, for display. */
  audience: string;
  channel: string;
  /** The `{placeholders}` the wording can use. */
  placeholders: string[];
  enabled: boolean;
  title: string;
  body: string;
  default_title: string;
  default_body: string;
}

/** What a live notification carries when it is pushed (the inbox row itself is loaded from the API). */
export interface LiveNotification {
  type: string;
  title: string;
  body: string;
  /** Where it leads in the app, or ''. */
  url: string;
}

/** A pop-up on screen for a live notification. */
export interface NotificationToast extends LiveNotification {
  key: number;
}

/** A message written by hand: at least one role or person, optionally limited to one batch. */
export interface SendNotificationBody {
  roles: string[];
  batch_id: number | null;
  users: string[];
  title: string;
  body: string;
}

/** Role values the API takes, with their display names. */
export const NOTIFICATION_ROLES: { value: string; label: string }[] = [
  { value: 'student', label: 'Students' },
  { value: 'mentor', label: 'Mentors' },
  { value: 'trainer', label: 'Trainers' },
  { value: 'member', label: 'Members' },
  { value: 'institution', label: 'Institutions' },
  { value: 'admin', label: 'Admins' },
  { value: 'ob', label: 'OBs' },
  { value: 'super_admin', label: 'Super Admins' },
];
