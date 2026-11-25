import { SharpUser } from '../../core/data/models';

/** Envelope every sharp-api response uses: `{ ok: true, ...data }` or `{ ok: false, error, errors? }`. */
export type ApiOk<T = object> = { ok: true } & T;

/** UserResource from sharp-api. `id` is the public id (it contains slashes, e.g. SH2026/FCM/0412). */
export interface ApiUserResource {
  id: string;
  name: string;
  username: string | null;
  role: string;
  college_id: number | null;
  org: string | null;
  batch_id: number | null;
  batch: string;
  mobile: string | null;
  email: string | null;
  status: string;
  specialist: string | null;
  short_description: string | null;
  biography: string | null;
  must_change_password: boolean;
  initials: string;
  color: string;
  /** URL of the uploaded profile picture, or null. */
  avatar: string | null;
  last_login: string | null;
  created_at: string | null;
}

export interface UserListFilters { role?: string; college_id?: number; batch_id?: number; status?: string; q?: string }

/** Body of PUT /users/{id}. Role and status are not editable; `username` is required. */
export interface UpdateUserBody {
  name: string;
  username: string;
  college_id?: number;
  org?: string;
  batch_id?: number;
  mobile?: string;
  email?: string;
  specialist?: string;
  short_description?: string;
  biography?: string;
  /** A new profile picture as a data URL (PNG, JPEG or WebP, up to 300 KB). */
  avatar?: string;
  avatar_remove?: boolean;
}

/** Body of POST /users. */
export interface CreateUserBody {
  role: string;
  name: string;
  username?: string;
  temp_password?: string;
  college_id?: number;
  org?: string;
  batch_id?: number;
  mobile?: string;
  email?: string;
  avatar?: string;
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);

/** "13 Oct 2026, 9:00 AM" from the API's timestamp, or "Never signed in". */
function fmtLast(v: string | null | undefined): string {
  if (!v) return 'Never signed in';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

/** API user -> the portal's SharpUser record. `roleLabel` is EnumsService.roleLabel. */
export function toSharpUser(u: ApiUserResource, roleLabel: (slug: string) => string | null): SharpUser {
  return {
    id: u.id,
    n: u.name,
    r: roleLabel(u.role) ?? cap(u.role),
    org: u.org ?? '',
    b: u.batch || 'All batches',
    // An invited user who has signed in is active, even if the server has not flipped the status yet.
    st: cap(u.status) === 'Invited' && u.last_login ? 'Active' : cap(u.status),
    ph: u.mobile ?? '',
    email: u.email ?? undefined,
    username: u.username ?? undefined,
    i: u.initials,
    col: u.color,
    pic: u.avatar ?? undefined,
    last: fmtLast(u.last_login),
    tempPw: u.must_change_password || undefined,
    spec: u.specialist ?? '',
    sd: u.short_description ?? '',
    bio: u.biography ?? '',
    collegeId: u.college_id ?? undefined,
    batchId: u.batch_id ?? undefined,
  };
}
