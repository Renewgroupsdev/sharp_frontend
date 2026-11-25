
import { Injectable, inject } from '@angular/core';
import { LocalCollection } from '../../core/data/local-collection';
import { Institute } from '../../core/data/models';
import { buildInstitutes } from '../../core/data/seed';
import { InstituteInput } from '../models/institute.model';
import {
  InstitutesApi,
  InstituteApiResource,
  InstitutePayload,
} from './institute-api.service';
import { ActivityLogService } from './activity-log.service';
import { BatchesService } from './batches.service';
import { UsersService } from './users.service';

const MODULE = 'Institute Management';

@Injectable({ providedIn: 'root' })
export class InstitutesService extends LocalCollection<Institute> {
  private readonly users = inject(UsersService);
  private readonly batches = inject(BatchesService);
  private readonly log = inject(ActivityLogService);
  private readonly api = inject(InstitutesApi);

  private loadingPromise?: Promise<void>;

  constructor() {
    super('institutes', buildInstitutes, 'ORG', 3);
  }

  activeInstitutes(): Institute[] {
    return this.items().filter(o => o.st === 'Active');
  }

  names(): string[] {
    return this.items().map(o => o.n);
  }

  studentCount(o: Institute): number {
    return this.users.students().filter(u => u.org === o.n).length;
  }

  /** Names of the institute's students, with their IDs. */
  studentNames(o: Institute): string[] {
    return this.users.students().filter(u => u.org === o.n).map(u => `${u.n} (${u.id})`);
  }

  /** Generate a unique institute code from its name. */
  codeFor(name: string): string {
    const taken = this.items().map(x => x.code);

    const base =
      String(name)
        .split(',')[0]
        .split(/\s+/)
        .filter(w => w && !/^(of|the|and|&)$/i.test(w))
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 4) || 'ORG';

    let code = base;
    let i = 2;

    while (taken.includes(code)) {
      code = base + i++;
    }

    return code;
  }

  nameTaken(name: string, exceptId?: string): boolean {
    return this.items().some(
      x =>
        x.id !== exceptId &&
        x.n.toLowerCase() === name.trim().toLowerCase()
    );
  }

  /** Convert API data to the existing frontend Institute model. */
  private mapApiInstitute(row: InstituteApiResource): Institute {
    return {
      id: String(row.id),
      n: row.name,
      code: row.code || '',
      city: row.city || '',
      pr: row.principal_name || '',
      email: row.email || '',
      ph: row.mobile || '',
      st: row.status === 'Inactive' ? 'Inactive' : 'Active',
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      geofenceRadiusM: row.geofence_radius_m ?? 200,
    };
  }

  /** Convert form data to the Laravel college API payload. */
  private toApiPayload(input: InstituteInput): InstitutePayload {
    return {
      name: input.n.trim(),
      city: input.city.trim(),
      principal_name: input.pr.trim(),
      email: input.email.trim(),
      mobile: input.ph.trim(),
      status: input.st.trim() || 'Active',
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      geofence_radius_m: input.geofenceRadiusM ?? 200,
    };
  }

  /** Load the institute list from Laravel. */
  loadInstitutes(): Promise<void> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = (async () => {
      try {
        const response = await this.api.getInstitutes();

        if (
          response.ok !== true ||
          !Array.isArray(response.colleges)
        ) {
          throw new Error('Invalid institute list response from API.');
        }

        this.replace(
          response.colleges.map(row => this.mapApiInstitute(row))
        );
      } finally {
        this.loadingPromise = undefined;
      }
    })();

    return this.loadingPromise;
  }

  /** Create a new institute or update an existing institute. */
  async saveInstitute(
    input: InstituteInput,
    id?: string
  ): Promise<Institute> {
    const old = id ? this.get(id) : undefined;
    const payload = this.toApiPayload(input);

    if (this.nameTaken(payload.name, id)) {
      throw new Error(
        `An institute named "${payload.name}" already exists.`
      );
    }

    if (id && !old) {
      throw new Error('Institute not found. Please reload the list.');
    }

    if (old) {
      console.log('Updating institute', old.id, payload);
      const response = await this.api.updateInstitute(old.id, payload);
      console.log('Update response', response);

      if (response.ok !== true || !response.institute) {
        throw new Error('Unable to update institute.');
      }

      const saved = this.mapApiInstitute(response.institute);

      // Preserve existing frontend relationships when the name changes.
      if (old.n !== saved.n) {
        this.users.replace(
          this.users.items().map(user =>
            user.org === old.n ? { ...user, org: saved.n } : user
          )
        );

        this.batches.replace(
          this.batches.items().map(batch =>
            batch.orgs?.includes(old.n)
              ? {
                  ...batch,
                  orgs: batch.orgs.map(name =>
                    name === old.n ? saved.n : name
                  ),
                }
              : batch
          )
        );
      }

      this.update(old.id, saved);

      this.log.record(
        MODULE,
        `Updated ${saved.n} (${saved.code})`
      );

      return saved;
    }

    const response = await this.api.createInstitute(payload);

    if (response.ok !== true || !response.institute) {
      throw new Error('Unable to create institute.');
    }

    const saved = this.mapApiInstitute(response.institute);

    this.add(saved);

    this.log.record(
      MODULE,
      `Created ${saved.n} (${saved.code})`
    );

    return saved;
  }

  /** Return the reason deletion is blocked, or null when allowed. */
  deleteBlocker(o: Institute): string | null {
    const count = this.studentCount(o);

    return count
      ? `${count} student(s) belong to ${o.n} — move or remove them first`
      : null;
  }

  /** Delete an institute using Laravel. */
  async deleteInstitute(id: string): Promise<void> {
    const institute = this.get(id);

    if (!institute) {
      throw new Error('Institute not found.');
    }

    const blocker = this.deleteBlocker(institute);

    if (blocker) {
      throw new Error(blocker);
    }

    const response = await this.api.deleteInstitute(id);

    if (response.ok !== true) {
      throw new Error(response.message || 'Unable to delete institute.');
    }

    this.remove(id);

    this.log.record(MODULE, `Deleted ${institute.n}`);
  }
}
