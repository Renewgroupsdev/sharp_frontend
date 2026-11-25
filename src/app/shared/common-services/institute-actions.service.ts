import { Injectable, inject } from '@angular/core';
import { BatchRecord } from '../models/institute.model';
import { Institute } from '../../core/data/models';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { BatchesService } from './batches.service';
import { InstitutesService } from './institutes.service';
import { ToastService } from './toast.service';

/** Delete flows (guard, confirmation, toast) shared by the institute / batch lists and their detail dialogs. */
@Injectable({ providedIn: 'root' })
export class InstituteActionsService {
  private readonly institutes = inject(InstitutesService);
  private readonly batches = inject(BatchesService);
  private readonly toast = inject(ToastService);

  /** Deletes an institute after the blocker check and a confirmation. Resolves true when it was removed. */
  async removeInstitute(id: string): Promise<boolean> {
    const o = this.institutes.get(id);
    if (!o) return false;
    return this.confirmRemove(o.n, 'institute', this.institutes.deleteBlocker(o), () => this.institutes.deleteInstitute(id));
  }

  /** Deletes a batch after the blocker check and a confirmation. Resolves true when it was removed. */
  async removeBatch(id: string): Promise<boolean> {
    const b: BatchRecord | undefined = this.batches.get(id);
    if (!b) return false;
    return this.confirmRemove(b.n, 'batch', this.batches.deleteBlocker(b), () => this.batches.deleteBatch(id));
  }

  /** Common guard -> confirm -> delete -> toast sequence; `blocker` is the reason a delete is not allowed, if any. */
  private async confirmRemove(name: string, noun: string, blocker: string | null, doDelete: () => void | Promise<void>): Promise<boolean> {
    if (blocker) {
      this.toast.error(`Cannot delete ${noun}`, blocker);
      return false;
    }
    if (!(await this.toast.confirm(`Delete ${noun}?`, `Remove ${name}. This cannot be undone.`))) return false;
    try {
      await doDelete();
    } catch (error) {
      this.toast.error(`Unable to delete ${noun}`, apiErrorMessage(error));
      return false;
    }
    this.toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} deleted`);
    return true;
  }

  /** Institutes taking part in a batch; an empty list means every institute. */
  participants(b: BatchRecord): Institute[] {
    const names = b.orgs ?? [];
    const all = this.institutes.items();
    return names.length ? all.filter(o => names.includes(o.n)) : all;
  }
}
