import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivityLogService } from './activity-log.service';
import { CommunityApi, GroupWithMembers } from './community-api.service';
import { CommunityGroup, CommunityGroupBody, CommunityMember, CommunityOverview } from '../models/community.model';

const MODULE_NAME = 'SHARP Community';

/**
 * SHARP Community state, from the API: the signed-in person's groups (every group for staff), personal chats and the
 * overview numbers. Each action replaces the row with the server's answer, so the list never drifts from the database.
 * Messages are not kept here: the chat component fetches them per group.
 */
@Injectable({ providedIn: 'root' })
export class CommunityService {
  private readonly api = inject(CommunityApi);
  private readonly log = inject(ActivityLogService);

  readonly groups = signal<CommunityGroup[]>([]);
  readonly dms = signal<CommunityGroup[]>([]);
  readonly overview = signal<CommunityOverview | null>(null);
  readonly loaded = signal(false);

  readonly chatGroups = computed(() => this.groups().filter(g => g.kind === 'Chat'));
  readonly announcementGroups = computed(() => this.groups().filter(g => g.kind === 'Announcement'));
  /** The org-wide chat every user is in; its messages are shared with the mobile app. */
  readonly floorGroupId = computed(() => this.groups().find(g => g.source === 'floor' && g.kind === 'Chat')?.id ?? null);

  byKind(kind: 'Chat' | 'Announcement'): CommunityGroup[] { return kind === 'Chat' ? this.chatGroups() : this.announcementGroups(); }

  async load(): Promise<void> {
    this.groups.set(await this.api.groups());
    this.loaded.set(true);
  }

  async loadDms(): Promise<void> { this.dms.set(await this.api.dms()); }
  async loadOverview(): Promise<void> { this.overview.set(await this.api.overview()); }

  /** Groups, personal chats and the overview, in one go (staff). */
  async refreshAll(): Promise<void> {
    await Promise.all([this.load(), this.loadDms(), this.loadOverview()]);
  }

  group(id: number): CommunityGroup | undefined {
    return this.groups().find(g => g.id === id) ?? this.dms().find(g => g.id === id);
  }

  /** The group and the people in it, with the cached row refreshed. */
  async open(id: number): Promise<GroupWithMembers> {
    return this.keep(await this.api.group(id));
  }

  async create(body: CommunityGroupBody): Promise<GroupWithMembers> {
    const res = this.keep(await this.api.createGroup(body));
    this.log.record(MODULE_NAME, `Created ${body.kind.toLowerCase()} group “${body.name}” (${body.members.length} selected)`);
    void this.loadOverview().catch(() => undefined);
    return res;
  }

  async update(id: number, body: { name?: string; members?: string[] }): Promise<GroupWithMembers> {
    const res = this.keep(await this.api.updateGroup(id, body));
    this.log.record(MODULE_NAME, `Updated group “${res.group.title}”`);
    return res;
  }

  async addMembers(id: number, members: string[]): Promise<GroupWithMembers> {
    const res = this.keep(await this.api.addMembers(id, members));
    this.log.record(MODULE_NAME, `Added ${members.length} member(s) to “${res.group.title}”`);
    return res;
  }

  async removeMember(id: number, member: CommunityMember): Promise<GroupWithMembers> {
    const res = this.keep(await this.api.removeMember(id, member.user_id));
    this.log.record(MODULE_NAME, `Removed ${member.name} from “${res.group.title}”`);
    return res;
  }

  async delete(group: CommunityGroup): Promise<void> {
    await this.api.deleteGroup(group.id);
    this.groups.update(list => list.filter(g => g.id !== group.id));
    this.dms.update(list => list.filter(g => g.id !== group.id));
    this.log.record(MODULE_NAME, group.source === 'dm' ? `Deleted personal chat ${group.title}` : `Deleted ${group.kind.toLowerCase()} group “${group.title}”`);
    void this.loadOverview().catch(() => undefined);
  }

  /** Pins or unpins a chat in the signed-in person's own list (the API allows a few pins). */
  async pin(group: CommunityGroup, pinned: boolean): Promise<void> {
    await this.api.pin(group.id, pinned);
    const at = pinned ? new Date().toISOString() : null;
    const swap = (list: CommunityGroup[]) => list.map(g => (g.id === group.id ? { ...g, pinned, pinned_at: at } : g));
    this.groups.update(swap);
    this.dms.update(swap);
  }

  /** Starts, or finds, the personal chat with someone and returns it. */
  async openDm(userId: string): Promise<CommunityGroup> {
    const group = await this.api.openDm(userId);
    this.dms.update(list => (list.some(g => g.id === group.id) ? list.map(g => (g.id === group.id ? group : g)) : [group, ...list]));
    return group;
  }

  /** Replaces (or adds) a group in the cache from an API answer. */
  private keep(res: GroupWithMembers): GroupWithMembers {
    const swap = (list: CommunityGroup[]) => (list.some(g => g.id === res.group.id) ? list.map(g => (g.id === res.group.id ? res.group : g)) : [...list, res.group]);
    if (res.group.source === 'dm') this.dms.update(swap);
    else this.groups.update(swap);
    return res;
  }
}
