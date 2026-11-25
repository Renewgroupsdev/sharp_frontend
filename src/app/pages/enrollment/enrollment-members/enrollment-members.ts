import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { BatchEnrollmentsService } from '../../../shared/common-services/batch-enrollments.service';
import { EnrollmentMember, MemberKind } from '../../../shared/models/batch-enrollment.model';
import { downloadCsv } from '../../../shared/utils/csv-download.util';

/** The students and mentors of an enrollment's batch; opens on the list whose count was clicked. */
@Component({
  selector: 'app-enrollment-members',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './enrollment-members.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './enrollment-members.scss'],
})
export class EnrollmentMembers implements OnInit {
  private readonly ref = inject(MatDialogRef<EnrollmentMembers>);
  private readonly data = inject<{ id: string; kind: MemberKind }>(MAT_DIALOG_DATA);
  private readonly store = inject(BatchEnrollmentsService);

  readonly enrollment = this.store.get(this.data.id);
  readonly tab = signal<MemberKind>(this.data.kind);
  readonly members = signal<{ students: EnrollmentMember[]; mentors: EnrollmentMember[] }>({ students: [], mentors: [] });
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly query = signal('');

  /** The open list, narrowed by the search box. */
  readonly list = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.members()[this.tab()];
    return q ? all.filter(p => [p.name, p.id, p.org, p.email, p.mobile].some(v => (v ?? '').toLowerCase().includes(q))) : all;
  });

  async ngOnInit(): Promise<void> {
    try {
      this.members.set(await this.store.members(this.data.id));
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  select(kind: MemberKind): void {
    this.tab.set(kind);
    this.query.set('');
  }

  /** The open list (with the search applied) as a CSV. */
  exportList(): void {
    const kind = this.tab();
    downloadCsv(`${kind}-${this.enrollment?.batch ?? 'batch'}`.replace(/\s+/g, '-').toLowerCase(),
      ['ID', 'Name', 'Institute', 'Phone', 'Email', kind === 'students' ? 'Status' : 'Speciality'],
      this.list().map(p => [p.id, p.name, p.org, p.mobile, p.email, kind === 'students' ? p.status : p.specialist]));
  }

  close(): void { this.ref.close(); }
}
