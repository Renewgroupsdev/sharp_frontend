import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommunityMemberPicker } from '../../../pages/community/community-member-picker/community-member-picker';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CommunityService } from '../../common-services/community.service';
import { ToastService } from '../../common-services/toast.service';
import { UsersService } from '../../common-services/users.service';
import { COMMUNITY_OVERSIGHT_ROLES, CommunityGroup, CommunityMember } from '../../models/community.model';

/**
 * "Add members" and "Edit" of a group, shown inside the chat drawer instead of a popup.
 * `add`: pick people to add. `edit`: rename a custom group and change who is in it. Staff join every group on their own,
 * so they are never offered.
 */
@Component({
  selector: 'app-chat-group-manage',
  standalone: true,
  imports: [FormsModule, CommunityMemberPicker],
  template: `
    <div class="gm">
      <div class="gm-body">
        @if (mode() === 'edit') {
          <label class="gm-label" for="gm-name">Group name</label>
          <input id="gm-name" class="gm-input" maxlength="120" [ngModel]="name()" (ngModelChange)="name.set($event)" />
        }
        <label class="gm-label">{{ mode() === 'add' ? 'Choose people to add' : 'Members' }}</label>
        @if (loading()) {
          <p class="gm-note">Loading members…</p>
        } @else if (people().length) {
          <app-community-member-picker [users]="people()" [(selected)]="picked" />
        } @else {
          <p class="gm-note">Every active user is already a member of this group.</p>
        }
        @if (error(); as err) { <p class="gm-error" role="alert">{{ err }}</p> }
      </div>
      <div class="gm-foot">
        <span>{{ picked().length }} selected</span>
        <button type="button" class="gm-cancel" (click)="cancel.emit()">Cancel</button>
        <button type="button" class="gm-save" [disabled]="saving() || loading()" (click)="save()">
          <i class="bi bi-check-lg"></i> {{ saving() ? 'Saving…' : mode() === 'add' ? 'Add selected' : 'Save changes' }}
        </button>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .gm { display: flex; flex-direction: column; height: 100%; }
    .gm-body { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 18px; }
    .gm-label { display: block; margin: 8px 0 6px; font-size: 12.5px; font-weight: 600; color: #374151; }
    .gm-input { width: 100%; height: 42px; padding: 0 12px; border: 1px solid #d6dedb; border-radius: 10px; font: inherit; font-size: 14px; outline: 0; }
    .gm-input:focus { border-color: #5f9a88; }
    .gm-note { font-size: 13px; color: #6b7280; }
    .gm-error { margin: 10px 0 0; font-size: 12.5px; color: #b42318; }
    .gm-foot { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-top: 1px solid #e5e7eb; background: #fff; }
    .gm-foot span { flex: 1; font-size: 12.5px; color: #6b7280; }
    .gm-cancel, .gm-save { height: 40px; padding: 0 18px; border-radius: 10px; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .gm-cancel { border: 1px solid #d6dedb; background: #fff; color: #374151; }
    .gm-save { border: 0; background: var(--primary-dark, #0b5d49); color: #fff; }
    .gm-save:disabled { opacity: 0.55; cursor: not-allowed; }
  `,
})
export class ChatGroupManage implements OnInit {
  private readonly store = inject(CommunityService);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);

  readonly group = input.required<CommunityGroup>();
  readonly mode = input.required<'add' | 'edit'>();
  readonly done = output<void>();
  readonly cancel = output<void>();

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly name = signal('');
  protected readonly picked = signal<string[]>([]);
  private readonly inGroup = signal<CommunityMember[]>([]);

  protected readonly people = computed(() => {
    const offered = this.users.items().filter(u => u.st !== 'Suspended' && !COMMUNITY_OVERSIGHT_ROLES.includes(u.r));
    if (this.mode() === 'edit') return offered;
    const taken = new Set(this.inGroup().map(m => m.user_id));
    return offered.filter(u => !taken.has(u.id));
  });

  async ngOnInit(): Promise<void> {
    this.name.set(this.group().name ?? '');
    try {
      const { members } = await this.store.open(this.group().id);
      this.inGroup.set(members);
      if (this.mode() === 'edit') {
        const offered = new Set(this.people().map(u => u.id));
        this.picked.set(members.filter(m => m.removable && offered.has(m.user_id)).map(m => m.user_id));
      }
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(): Promise<void> {
    this.error.set(null);
    const name = this.name().trim();
    if (this.mode() === 'edit' && !name) { this.error.set('Enter a group name.'); return; }
    if (!this.picked().length) { this.toast.warning(this.mode() === 'add' ? 'Select at least one person to add' : 'Select at least one member'); return; }
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const g = this.group();
      if (this.mode() === 'add') {
        await this.store.addMembers(g.id, this.picked());
        this.toast.success(`${this.picked().length} member${this.picked().length === 1 ? '' : 's'} added`, g.title);
      } else {
        await this.store.update(g.id, { name, members: this.picked() });
        this.toast.success('Group updated', name);
      }
      this.done.emit();
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}
