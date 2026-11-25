import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CommunityGroup, CommunityGroupBody, CommunityMember, CommunityMessage, CommunityOverview, CommunityPerson, GroupKind, GroupSource } from '../models/community.model';

/** A group and, when the call returns them, the people in it. */
export interface GroupWithMembers { group: CommunityGroup; members: CommunityMember[] }

/** Typed client for /api/web/community. Who may do what is decided by the API; this only carries the calls. */
@Injectable({ providedIn: 'root' })
export class CommunityApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/community`;

  private get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    return firstValueFrom(this.http.get<{ ok: boolean } & T>(`${this.base}/${path}`, { params }));
  }
  private post<T>(path: string, body: object): Promise<T> {
    return firstValueFrom(this.http.post<{ ok: boolean } & T>(`${this.base}/${path}`, body));
  }

  async groups(filters: { kind?: GroupKind; source?: GroupSource; q?: string } = {}): Promise<CommunityGroup[]> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) as Record<string, string>;
    return (await this.get<{ groups: CommunityGroup[] }>('groups', params)).groups;
  }

  group(id: number): Promise<GroupWithMembers> { return this.get<GroupWithMembers>(`groups/${id}`); }
  createGroup(body: CommunityGroupBody): Promise<GroupWithMembers> { return this.post<GroupWithMembers>('groups', body); }
  updateGroup(id: number, body: { name?: string; members?: string[] }): Promise<GroupWithMembers> {
    return firstValueFrom(this.http.put<{ ok: boolean } & GroupWithMembers>(`${this.base}/groups/${id}`, body));
  }
  addMembers(id: number, members: string[]): Promise<GroupWithMembers> { return this.post<GroupWithMembers>(`groups/${id}/members`, { members }); }
  removeMember(id: number, member: string): Promise<GroupWithMembers> { return this.post<GroupWithMembers>(`groups/${id}/members/remove`, { member }); }
  async deleteGroup(id: number): Promise<void> { await firstValueFrom(this.http.delete(`${this.base}/groups/${id}`)); }

  /** The messages plus the id of the newest message this person had read before opening the chat. */
  async messages(groupId: number): Promise<{ messages: CommunityMessage[]; lastRead: number; pinned: CommunityMessage[]; canPin: boolean }> {
    const res = await this.get<{ messages: CommunityMessage[]; last_read_message_id: number; pinned_messages: CommunityMessage[]; can_pin: boolean }>(`groups/${groupId}/messages`);
    return { messages: res.messages, lastRead: res.last_read_message_id ?? 0, pinned: res.pinned_messages ?? [], canPin: !!res.can_pin };
  }
  /** Pins or unpins a message for everyone in the chat; answers with the chat's pinned messages, newest pin first. */
  async pinMessage(groupId: number, messageId: number, pinned: boolean): Promise<CommunityMessage[]> {
    return (await this.post<{ pinned_messages: CommunityMessage[] }>(`groups/${groupId}/messages/${messageId}/pin`, { pinned })).pinned_messages;
  }
  async markRead(groupId: number, messageId?: number): Promise<void> { await this.post(`groups/${groupId}/read`, messageId ? { message_id: messageId } : {}); }
  async pin(groupId: number, pinned: boolean): Promise<void> { await this.post(`groups/${groupId}/pin`, { pinned }); }
  async postMessage(groupId: number, body: string): Promise<CommunityMessage> { return (await this.post<{ message: CommunityMessage }>(`groups/${groupId}/messages`, { body })).message; }
  async removeMessage(groupId: number, messageId: number): Promise<void> { await firstValueFrom(this.http.delete(`${this.base}/groups/${groupId}/messages/${messageId}`)); }

  /** Starts, or finds, the personal chat with another person (a public id). */
  async openDm(user: string): Promise<CommunityGroup> { return (await this.post<{ group: CommunityGroup }>('dm', { user })).group; }
  async dms(): Promise<CommunityGroup[]> { return (await this.get<{ groups: CommunityGroup[] }>('dms')).groups; }

  async overview(): Promise<CommunityOverview> { return (await this.get<{ overview: CommunityOverview }>('overview')).overview; }

  /** Staff: one person's groups and everything they have written. */
  person(user: string): Promise<{ person: CommunityPerson; groups: Pick<CommunityGroup, 'id' | 'name' | 'kind' | 'source'>[]; messages: CommunityMessage[] }> {
    return this.get('person', { user });
  }
}
