import { Injectable, Injector, inject } from '@angular/core';
import { LocalCollection } from '../../core/data/local-collection';
import { ROLES, ROLE_PREFIX, SharpUser } from '../../core/data/models';
import { buildUsers, initials } from '../../core/data/seed';
import { BATCH_ROLES, INSTITUTE_ROLES, PROFILE_ROLES, USER_CSV_COLS, UserImportRow, UserInput } from '../models/user.model';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { CreateUserBody, UpdateUserBody, UserListFilters, toSharpUser } from '../models/api.model';
import { parseCsv } from '../utils/csv.util';
import { ActivityLogService } from './activity-log.service';
import { BatchesService } from './batches.service';
import { InstitutesService } from './institutes.service';
import { EnumsService } from './enums.service';
import { UsersApi } from './users-api.service';

const PAL = ['#0E7A4E', '#1B9AD6', '#C2186B', '#B4531B', '#6A4CB3', '#0A5B39', '#5B3FA8'];
const MODULE = 'User Management';
const pad = (n: number, w: number) => String(n).padStart(w, '0');

/** One-time password such as `Sharp-3fa91c`, from the browser's secure random source. */
export function generateTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  return 'Sharp-' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** Everyone with a SHARP account: students, mentors, admins, members, OBs and institutions. */
@Injectable({ providedIn: 'root' })
export class UsersService extends LocalCollection<SharpUser> {
  private readonly log = inject(ActivityLogService);
  private readonly api = inject(UsersApi);
  private readonly enums = inject(EnumsService);
  /** Institutes / batches also depend on this store, so they are resolved lazily. */
  private readonly injector = inject(Injector);

  readonly csvColumns = USER_CSV_COLS;

  constructor() { super('users', buildUsers, 'US', 3); }

  private get institutes(): InstitutesService { return this.injector.get(InstitutesService); }
  private get batches(): BatchesService { return this.injector.get(BatchesService); }

  /** Loads the user list from GET /users into the store. A failure keeps what is already there and returns the message. */
  async refresh(filters: UserListFilters = {}): Promise<string | null> {
    try {
      this.replace((await this.api.list(filters)).users.map(u => toSharpUser(u, this.enums.roleLabel)));
      return null;
    } catch (e) { return apiErrorMessage(e); }
  }

  students(): SharpUser[] { return this.items().filter(u => u.r === 'Student'); }
  byRole(role: string): SharpUser[] { return this.items().filter(u => u.r === role); }
  /** Profile picture link of a person, by user id; empty when they have none. */
  photoOf(id: string | null | undefined): string { return (id ? this.get(id)?.pic : '') ?? ''; }
  nameOf(id: string): string { return this.get(id)?.n ?? id; }
  /** Institute of a person, by user id. */
  orgOf(id: string): string { return this.get(id)?.org ?? '—'; }

  /** Student ID built from the college code and year, e.g. `FC26-0001`. */
  genStudentId(orgName: string): string {
    const code = this.institutes.items().find(o => o.n === orgName)?.code ?? 'SH';
    const prefix = `${code}${String(new Date().getFullYear()).slice(2)}-`;
    const all = this.items();
    let n = all.filter(u => String(u.id).startsWith(prefix)).length + 1;
    let id: string;
    do { id = prefix + pad(n++, 4); } while (all.some(u => u.id === id));
    return id;
  }

  /** ID for a new account: the student scheme for students, `<role prefix>-NNN` for everyone else. */
  genId(role: string, org = ''): string {
    if (role === 'Student') return this.genStudentId(org);
    const p = ROLE_PREFIX[role] || 'US';
    const all = this.items();
    let n = all.filter(u => String(u.id).startsWith(`${p}-`)).length + 1;
    let id: string;
    do { id = `${p}-${pad(n++, 3)}`; } while (all.some(u => u.id === id));
    return id;
  }

  private colour(): string { return PAL[this.items().length % PAL.length]; }

  /** First problem with the form values, or null when they can be saved. */
  validate(input: UserInput, id?: string): string | null {
    const un = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,}$/.test(un)) return 'Username: at least 3 letters, numbers, dot or underscore';
    if (this.items().some(x => x.id !== id && String(x.username || '').toLowerCase() === un)) return 'That username is already taken';
    if (!/^\d{10}$/.test(input.ph.trim())) return 'Mobile number must be 10 digits';
    if (!id && input.pw.trim().length < 6) return 'Temporary password needs at least 6 characters';
    if (this.items().some(x => x.id !== id && x.email && x.email.toLowerCase() === email)) return 'That email is already used by another user';
    return null;
  }

  /**
   * Creates (no `id`, POST /users) or updates a user from the form values and logs it. Run `validate` first.
   * Rejects with the API's message. Colleges / batches are not wired to the API yet: a create sends no college_id /
   * batch_id, and an edit sends back the ids the user already has (so changing institute or batch is not saved).
   */
  async saveUser(input: UserInput, id?: string): Promise<{ user: SharpUser; tempPassword?: string }> {
    if (id) return { user: await this.saveEdit(input, id) };
    const body: CreateUserBody = {
      role: this.enums.roleSlug(input.r), name: input.n.trim(), username: input.username.trim().toLowerCase(),
      temp_password: input.pw.trim() || undefined,
      // The API wants a college for institute roles: reuse the one an existing user of that institute already has.
      college_id: INSTITUTE_ROLES.includes(input.r) ? this.items().find(u => u.org === input.org && u.collegeId)?.collegeId : undefined,
      org: (INSTITUTE_ROLES.includes(input.r) ? input.org : input.org2).trim() || undefined,
      mobile: input.ph.trim() || undefined, email: input.email.trim() || undefined,
      avatar: input.pic?.startsWith('data:') ? input.pic : undefined,
    };
    try {
      const res = await this.api.create(body);
      const user = { ...toSharpUser(res.user, this.enums.roleLabel), spec: input.spec.trim(), sd: input.sd.trim(), bio: input.bio.trim() };
      this.add(user);
      this.log.record(MODULE, `Created user ${user.id} ${user.n} (${user.r})`);
      return { user, tempPassword: res.temp_password };
    } catch (e) { throw new Error(apiErrorMessage(e)); }
  }

  /** PUT /users/{id}, then replaces the stored record with what the API returns. */
  private async saveEdit(input: UserInput, id: string): Promise<SharpUser> {
    const old = this.get(id);
    const hasProf = PROFILE_ROLES.includes(input.r);
    const body: UpdateUserBody = {
      name: input.n.trim(), username: input.username.trim().toLowerCase(),
      college_id: old?.collegeId, batch_id: old?.batchId,
      org: (INSTITUTE_ROLES.includes(input.r) ? input.org : input.org2).trim() || undefined,
      mobile: input.ph.trim() || undefined, email: input.email.trim() || undefined,
      specialist: hasProf ? input.spec.trim() || undefined : undefined,
      short_description: hasProf ? input.sd.trim() || undefined : undefined,
      biography: hasProf ? input.bio.trim() || undefined : undefined,
      // A picture picked just now is a data URL; one already saved is a link and is left alone.
      avatar: input.pic?.startsWith('data:') ? input.pic : undefined,
      avatar_remove: !input.pic && !!old?.pic ? true : undefined,
    };
    try {
      const res = await this.api.update(id, body);
      const user = { ...toSharpUser(res.user, this.enums.roleLabel) };
      this.update(id, user);
      this.log.record(MODULE, `Updated user ${user.id} ${user.n} (${user.r})`);
      return user;
    } catch (e) { throw new Error(apiErrorMessage(e)); }
  }

  /** Suspends / re-activates through the API, then mirrors it in the store. Rejects with the API's message. */
  async setStatus(id: string, st: string): Promise<void> {
    const u = this.get(id);
    if (!u) return;
    try { await (st === 'Suspended' ? this.api.suspend(id) : this.api.activate(id)); } catch (e) { throw new Error(apiErrorMessage(e)); }
    this.update(id, { st });
    this.log.record(MODULE, `Updated user ${u.id} ${u.n} (${u.r}) - ${st}`);
  }

  /** Why the account cannot be deleted, or null when it can: records of people in a running batch are kept. */
  deleteBlocker(u: SharpUser): string | null {
    const running = BATCH_ROLES.includes(u.r) && this.batches.items().some(b => b.n === u.b && b.st === 'running');
    return running ? `${u.n} is in ${u.b}, which is running. Suspend the account instead, or move them to another batch first.` : null;
  }

  /** DELETE /users/{id}; the record leaves the store only once the API accepts it. Rejects with the API's message. */
  async deleteUser(id: string): Promise<void> {
    try { await this.api.remove(id); } catch (e) { throw new Error(apiErrorMessage(e)); }
    const u = this.remove(id);
    if (u) this.log.record(MODULE, `Deleted user ${u.id} ${u.n}`);
  }

  /** Moves the account to another batch; history stays with the user. */
  changeBatch(id: string, batch: string): void {
    const u = this.get(id);
    if (!u || u.b === batch) return;
    this.update(id, { b: batch });
    this.log.record(MODULE, `Moved user ${u.id} ${u.n} from ${u.b} to ${batch}`);
  }

  /** POST /reset-password: the account is marked must-change and the new temporary password is returned (never stored or logged). */
  async resetPassword(id: string): Promise<string | null> {
    const u = this.get(id);
    if (!u) return null;
    try {
      const { temp_password } = await this.api.resetPassword(id);
      this.update(id, { tempPw: true });
      this.log.record(MODULE, `Reset password for user ${u.id} ${u.n} (${u.r})`);
      return temp_password;
    } catch (e) { throw new Error(apiErrorMessage(e)); }
  }

  /**
   * Builds the WhatsApp login invitation for the user and stores its full text in the audit log.
   * Returns the wa.me link to open, or null when the user or a 10-digit mobile number is missing.
   * The message never carries a password: it names the username and tells them to use the temporary password already issued.
   */
  resendInvite(id: string): { url: string; message: string } | null {
    const u = this.get(id);
    const digits = String(u?.ph ?? '').replace(/\D/g, '').slice(-10);
    if (!u || digits.length !== 10) return null;
    const message =
      `Hello ${u.n}, you are invited to SHARP (TNCCI). ` +
      `Sign in at ${window.location.origin} with username "${u.username ?? ''}" and the temporary password shared with you. ` +
      `You will be asked to set your own password at first sign-in.`;
    this.log.record(MODULE, `Sent WhatsApp login invite to user ${u.id} ${u.n} (+91 ${digits}): "${message}"`);
    return { url: `https://wa.me/91${digits}?text=${encodeURIComponent(message)}`, message };
  }

  /** Parses a bulk-upload CSV into validated rows; `error` is set when the file itself is unusable. */
  previewImport(text: string): { rows: UserImportRow[]; error?: string } {
    const rows = parseCsv(text);
    if (rows.length < 2) return { rows: [], error: 'The file has no data rows.' };
    const h = rows[0].map(x => x.trim().toLowerCase().replace(/\s+/g, '_'));
    const ix = (k: string) => h.indexOf(k);
    if (ix('full_name') < 0 || ix('role') < 0) return { rows: [], error: 'Missing required columns: role, full_name. Download the sample CSV to see the format.' };

    const orgs = this.institutes.items();
    const batchNames = this.batches.items().map(b => b.n);
    const seenUn = new Set(this.items().map(u => String(u.username || '').toLowerCase()));
    const seenMail = new Set(this.items().map(u => String(u.email || '').toLowerCase()));

    const parsed = rows.slice(1).map((r, n): UserImportRow => {
      const g = (k: string) => (ix(k) >= 0 ? (r[ix(k)] || '').trim() : '');
      const errs: string[] = [];
      const role = ROLES.find(x => x.toLowerCase() === g('role').toLowerCase()) ?? '';
      if (!role) errs.push('unknown role');
      const org = orgs.find(o => o.n.toLowerCase() === g('college').toLowerCase() || o.code.toLowerCase() === g('college').toLowerCase());
      if (role === 'Student' && !org) errs.push('college not found');
      if (!g('full_name')) errs.push('name missing');
      const un = (g('username') || g('full_name').toLowerCase().replace(/[^a-z0-9]+/g, '.')).replace(/^\.|\.$/g, '');
      if (seenUn.has(un.toLowerCase())) errs.push('username in use');
      if (g('email') && seenMail.has(g('email').toLowerCase())) errs.push('email in use');
      if (g('mobile') && !/^\d{10}$/.test(g('mobile'))) errs.push('mobile not 10 digits');
      if (!errs.length) { seenUn.add(un.toLowerCase()); if (g('email')) seenMail.add(g('email').toLowerCase()); }
      const batch = batchNames.find(b => b.toLowerCase() === g('batch').toLowerCase());
      return {
        line: n + 2, errs, role, org: org ? org.n : g('college'),
        b: batch ?? (role === 'Student' || role === 'Mentor' ? batchNames[0] ?? 'All batches' : 'All batches'),
        n: g('full_name'), username: un, ph: g('mobile') ? `+91 ${g('mobile')}` : '', email: g('email'),
        spec: g('specialist'), sd: g('short_description'), bio: g('biography'),
        st: ['Active', 'Invited', 'Suspended'].find(s => s.toLowerCase() === g('status').toLowerCase()) ?? 'Invited',
      };
    });
    return { rows: parsed };
  }

  /** Creates accounts for every valid row and logs one bulk entry. Returns how many were created. */
  importUsers(rows: UserImportRow[]): number {
    const ok = rows.filter(x => !x.errs.length);
    for (const x of ok) {
      const org = x.org || 'TNCCI Programme Office';
      this.add({
        id: this.genId(x.role, org), r: x.role, org, b: x.b, n: x.n, username: x.username, ph: x.ph, email: x.email,
        spec: x.spec, sd: x.sd, bio: x.bio, st: x.st, i: initials(x.n), col: this.colour(), last: 'Never signed in',
      });
    }
    if (ok.length) this.log.record(MODULE, `Bulk upload: ${ok.length} users created`);
    return ok.length;
  }

  sampleCsvRows(): string[][] {
    const org = this.institutes.items()[0];
    const batch = this.batches.items()[0]?.n ?? '';
    return [
      ['Student', org?.code ?? '', batch, 'Anitha Devi', 'anitha.devi', 'Temp@1234', '9876543210', 'anitha@example.com', '', '', '', 'Invited'],
      ['Mentor', org?.n ?? '', batch, 'S. Karthik', 'karthik.mentor', 'Temp@1234', '9876500011', 'karthik@example.com', 'Operations', 'Plant manager, 12 yrs', 'Mentors final-year students.', 'Active'],
    ];
  }
}
