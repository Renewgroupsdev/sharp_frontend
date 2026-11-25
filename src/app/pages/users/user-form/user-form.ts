import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { SharpUser } from '../../../core/data/models';
import { initials } from '../../../core/data/seed';
import { BatchesService } from '../../../shared/common-services/batches.service';
import { EnumsService } from '../../../shared/common-services/enums.service';
import { InstitutesService } from '../../../shared/common-services/institutes.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { MultiSelect } from '../../../shared/components/multi-select/multi-select';
import { RichTextEditor } from '../../../shared/components/rich-text-editor/rich-text-editor';
import { UsersApi } from '../../../shared/common-services/users-api.service';
import { UsersService, generateTempPassword } from '../../../shared/common-services/users.service';
import { BATCH_ROLES, INSTITUTE_ROLES, PROFILE_ROLES, UserInput } from '../../../shared/models/user.model';

/** Add / edit a user. */
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, RichTextEditor, MultiSelect],
  templateUrl: './user-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class UserForm {
  private readonly dialogRef = inject(MatDialogRef<UserForm, boolean>);
  private readonly data = inject<{ userId?: string }>(MAT_DIALOG_DATA);
  private readonly users = inject(UsersService);
  private readonly institutes = inject(InstitutesService);
  private readonly batches = inject(BatchesService);
  private readonly toast = inject(ToastService);
  private readonly enums = inject(EnumsService);

  readonly existing: SharpUser | undefined = this.data.userId ? this.users.get(this.data.userId) : undefined;
  readonly isEdit = !!this.existing;
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly statuses = this.enums.userStatuses();
  readonly maxPic = 300 * 1024;

  /** Role dropdown: the roles the backend lists (GET /enums). */
  readonly roles = this.enums.allRoles;
  readonly instituteNames = computed(() => {
    const names = this.institutes.activeInstitutes().map(i => i.n);
    // const names = this.institutes.names();
    const cur = this.existing?.org;
  
    return cur && !names.includes(cur) && INSTITUTE_ROLES.includes(this.existing!.r) ?  [...names, cur] : names;
  });
  readonly batchNames = computed(() => this.batches.names());

  model: UserInput = this.existing
    ? {
        r: this.existing.r,
        org: this.existing.org || this.institutes.names()[0] || '',
        org2: INSTITUTE_ROLES.includes(this.existing.r) ? '' : this.existing.org || '',
        b: this.existing.b || this.batches.names()[0] || '',
        n: this.existing.n, username: this.existing.username ?? '', pw: '',
        ph: String(this.existing.ph || '').replace(/^\+91\s?/, ''), email: this.existing.email ?? '',
        spec: this.existing.spec ?? '', sd: this.existing.sd ?? '', bio: this.existing.bio ?? '',
        st: this.existing.st || 'Active', pic: this.existing.pic ?? null,
      }
    : {
        r: 'Student', org: this.institutes.names()[0] ?? '', org2: '', b: this.batches.names()[0] ?? '', n: '', username: '', pw: '',
        ph: '', email: '', spec: '', sd: '', bio: '', st: 'Active', pic: null,
      };

  picName = '';

  /** The Specialist pick-list and what is ticked for this user (stored as one comma-separated text). */
  readonly specialistOptions = signal<string[]>(['Startup', 'Document', 'Technologies', 'Leadership']);
  readonly specialists = signal<string[]>((this.existing?.spec ?? '').split(',').map(s => s.trim()).filter(Boolean));

  constructor() {
    inject(UsersApi).specialists().then(res => this.specialistOptions.set(res.specialists)).catch(() => undefined);
  }

  onSpecialists(list: string[]): void {
    this.specialists.set(list);
    this.model.spec = list.join(', ');
  }

  /** Initials shown in the thumbnail until a picture is chosen. */
  get initials(): string { return this.model.n.trim() ? initials(this.model.n) : '?'; }

  get showInstitute(): boolean { return INSTITUTE_ROLES.includes(this.model.r); }
  get showOrganization(): boolean { return !this.showInstitute; }
  get showBatch(): boolean { return BATCH_ROLES.includes(this.model.r); }
  get showProfile(): boolean { return PROFILE_ROLES.includes(this.model.r); }

  /** Which ID the new account will be given. */
  idNote(): string {
    return this.model.r === 'Student'
      ? `Student ID will be generated from the college code: ${this.users.genStudentId(this.model.org)}`
      : `User ID ${this.users.genId(this.model.r)} will be issued.`;
  }

  /** Institution accounts are the institute's SPOC contacts: the account fields read "SPOC details". */
  get isSpoke(): boolean { return this.model.r === 'Institution'; }
  /** More spokes can be added or edited (each is its own Institution login for the same institute). */
  get canAddSpokes(): boolean { return this.isSpoke; }

  private spokeSeq = 0;
  /** Extra SPOCs beyond the first one (which uses the main form fields). On edit, starts with the institute's other SPOCs. */
  extras: SpokeDraft[] = this.loadSiblings();

  /** The other Institution users of the same institute, as editable drafts (edit mode only). */
  private loadSiblings(): SpokeDraft[] {
    const e = this.existing;
    if (!e || e.r !== 'Institution' || !e.org) return [];
    return this.users.byRole('Institution')
      .filter(u => u.id !== e.id && u.org === e.org)
      .map(u => ({
        id: ++this.spokeSeq, uid: u.id, n: u.n, username: u.username ?? '', pw: '',
        ph: String(u.ph || '').replace(/^\+91\s?/, ''), email: u.email ?? '',
      }));
  }

  addSpoke(): void { this.extras = [...this.extras, { id: ++this.spokeSeq, n: '', username: '', pw: '', ph: '', email: '' }]; }
  /** Only new (unsaved) SPOCs can be removed; saved ones have no delete here. */
  removeSpoke(i: number): void { this.extras = this.extras.filter((s, idx) => idx !== i || !!s.uid); }
  generateSpokePassword(s: SpokeDraft): void { s.pw = generateTempPassword(); }

  /** Full form values for one extra spoke: same role / institute / profile as the first, its own account fields. */
  private spokeInput(s: SpokeDraft): UserInput { return { ...this.model, n: s.n, username: s.username, pw: s.pw, ph: s.ph, email: s.email, pic: null }; }

  /** First problem across the extra spokes (blank fields, rules, duplicates inside the form), or null. */
  private extrasProblem(): string | null {
    const seenUn = new Set([this.model.username.trim().toLowerCase()]);
    const seenEm = new Set([this.model.email.trim().toLowerCase()]);
    for (const [i, s] of this.extras.entries()) {
      const tag = `SPOC ${i + 2}: `;
      if (!s.n.trim() || !s.username.trim() || !s.ph.trim() || !s.email.trim()) return tag + 'fill in name, username, mobile and email';
      const problem = this.users.validate(this.spokeInput(s), s.uid);
      if (problem) return tag + problem;
      const un = s.username.trim().toLowerCase(), em = s.email.trim().toLowerCase();
      if (seenUn.has(un)) return tag + 'username is repeated in this form';
      if (seenEm.has(em)) return tag + 'email is repeated in this form';
      seenUn.add(un); seenEm.add(em);
    }
    return null;
  }

  generatePassword(): void {
    this.model.pw = generateTempPassword();
  }

  onPic(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > this.maxPic) {
      this.toast.error('Profile picture must be under 300 KB');
      (event.target as HTMLInputElement).value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { this.model.pic = String(reader.result); this.picName = file.name; };
    reader.readAsDataURL(file);
  }

  removePic(): void {
    this.model.pic = null;
    this.picName = '';
  }

  async save(form: NgForm): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (form.invalid) return;
    const problem = this.users.validate(this.model, this.existing?.id);
    if (problem) return void this.serverError.set(problem);
    const extraProblem = this.canAddSpokes ? this.extrasProblem() : null;
    if (extraProblem) return void this.serverError.set(extraProblem);
    const extras = this.canAddSpokes ? this.extras : [];
    let created = 0;
    try {
      const { user, tempPassword } = await this.users.saveUser(this.model, this.existing?.id);
      created++;
      // The update API ignores status, so Active / Suspended go through their own endpoints ('Invited' cannot be set by hand).
      if (this.existing && this.model.st !== this.existing.st && (this.model.st === 'Active' || this.model.st === 'Suspended')) {
        await this.users.setStatus(this.existing.id, this.model.st);
      }
      const passwords = [tempPassword];
      for (const s of extras) {
        passwords.push((await this.users.saveUser(this.spokeInput(s), s.uid)).tempPassword);
        created++;
      }
      if (extras.length) {
        this.toast.success(this.isEdit ? `${created} SPOCs saved` : `${created} SPOCs created`, passwords.some(Boolean) ? `Temporary passwords: ${passwords.filter(Boolean).join(", ")}` : undefined);
      } else {
        this.toast.success(this.isEdit ? "User updated" : `User ${user.id} created`, this.isEdit ? undefined : tempPassword ? `Temporary password: ${tempPassword}` : "Temporary password set");
      }
      this.dialogRef.close(true);
    } catch (e) {
      const msg = (e as Error).message;
      if (created === 0) return void this.serverError.set(msg);
      // Some spokes already exist: close so the list shows them, and say which one failed.
      this.toast.error(`Saved ${created} of ${extras.length + 1} SPOCs`, `SPOC ${created + 1} failed: ${msg}. Save the remaining SPOCs again.`);
      this.dialogRef.close(true);
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }
}

/** One extra spoke contact being added alongside the main one. */
interface SpokeDraft { id: number; uid?: string; n: string; username: string; pw: string; ph: string; email: string; }
