import { Component, OnInit, computed, inject } from '@angular/core';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { CertificateActionsService } from '../../../shared/common-services/certificate-actions.service';
import { CertificatesService } from '../../../shared/common-services/certificates.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { CountRibbon } from '../../../shared/components/count-ribbon/count-ribbon';
import { CommonFilterCard } from '../../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../../shared/components/common-table-card/common-table-card';
import { LocalListBase } from '../../../shared/components/local-list-base';
import { CanActionDirective } from '../../../shared/directives/can-action.directive';
import { CERT_STATUSES, Certificate } from '../../../shared/models/certificate.model';
import { RibbonItem, QuickAction, TableColumn, TableRow } from '../../../shared/models/common-components.model';
import { CertificateEditForm } from '../certificate-edit-form/certificate-edit-form';
import { CertificateForm } from '../certificate-form/certificate-form';

const pct = (v: number | null): string => (v === null ? '—' : `${v}%`);
const day = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/** Every certificate: filter, preview, issue (against the minimums), reject, cancel (with a reason) and download. */
@Component({
  selector: 'app-certificate-list',
  standalone: true,
  imports: [CountRibbon, CommonFilterCard, CommonTableCard, CanActionDirective],
  templateUrl: './certificate-list.html',
  styleUrls: ['../../../shared/styles/erp-page.scss'],
})
export class CertificateList extends LocalListBase implements OnInit {
  private readonly store = inject(CertificatesService);
  private readonly actions = inject(CertificateActionsService);
  private readonly toast = inject(ToastService);

  protected readonly noun = 'certificates';
  protected override filterFields = { status: 'status', source: 'course', branch: ['name'] };

  override filters = [
    { key: 'source', label: 'Course', options: [] as string[] },
    { key: 'status', label: 'Status', options: [...CERT_STATUSES] as string[] },
  ];

  columns: TableColumn[] = [
    { key: 'student', header: 'Student', type: 'lead', width: '18%' },
    { key: 'course', header: 'Course', width: '17%' },
    { key: 'number', header: 'Certificate ID', width: '13%' },
    { key: 'marks', header: 'Score · attendance', width: '16%' },
    { key: 'issued', header: 'Issued on', width: '11%' },
    { key: 'status', header: 'Status', type: 'badge', width: '9%' },
    { key: 'actions', header: 'Actions', type: 'quickActions', width: '12%', sortable: false },
  ];

  override sortActive = 'id';
  override sortDirection: 'asc' | 'desc' = 'desc';

  readonly stats = computed<RibbonItem[]>(() => {
    const all = this.store.items();
    const n = (s: string) => all.filter(c => c.status === s).length;
    return [
      { label: 'Certificates', value: all.length, icon: 'bi-award', iconVariant: 'blue' },
      { label: 'Awaiting approval', value: n('Pending'), icon: 'bi-hourglass-split', iconVariant: 'orange', filter: { key: 'status', value: 'Pending' } },
      { label: 'Issued', value: n('Issued'), icon: 'bi-check-circle-fill', iconVariant: 'green', filter: { key: 'status', value: 'Issued' } },
      { label: 'Cancelled', value: n('Cancelled'), icon: 'bi-slash-circle', iconVariant: 'purple', filter: { key: 'status', value: 'Cancelled' } },
    ];
  });

  ngOnInit(): void {
    this.store.load().then(() => {
      this.filters = [{ ...this.filters[0], options: [...new Set(this.store.items().map(c => c.course))] }, this.filters[1]];
    }).catch(e => this.toast.error('Could not load certificates', apiErrorMessage(e)));
  }

  protected allRows(): TableRow[] {
    return this.store.items().map(c => ({
      id: c.id,
      student: { name: c.name, subtitle: c.student_id },
      searchText: `${c.name} ${c.student_id} ${c.number ?? ''} ${c.course}`,
      name: c.name,
      course: c.course,
      number: c.number ?? '—',
      marks: `${pct(c.score)} · ${pct(c.attendance)}${c.edited && c.status !== 'Issued' ? ' · edited' : ''}${c.override ? ' · override' : c.eligibility && !c.eligibility.ok && c.status === 'Pending' ? ' · below min' : ''}`,
      issued: day(c.issued_at ?? c.issue_date),
      __issued: c.issued_at ?? c.issue_date ?? '',
      status: c.status,
      actions: this.actionsFor(c),
    }));
  }

  private actionsFor(c: Certificate): QuickAction[] {
    const list: QuickAction[] = [{ key: 'view', icon: 'bi-eye', label: 'Preview', variant: 'primary', permission: 'a_certs.view' }];
    if (c.status === 'Issued') {
      list.push({ key: 'download', icon: 'bi-download', label: 'Download', variant: 'primary', permission: 'a_certs.view' });
      list.push({ key: 'cancel', icon: 'bi-slash-circle', label: 'Cancel certificate', variant: 'danger', permission: 'a_certs.edit' });
    } else if (c.status === 'Cancelled') {
      list.push({ key: 'delete', icon: 'bi-trash3-fill', label: 'Delete', variant: 'danger', permission: 'a_certs.delete' });
    } else {
      list.push({ key: 'edit', icon: 'bi-pencil-square', label: 'Edit details', variant: 'primary', permission: 'a_certs.edit' });
      list.push({ key: 'issue', icon: 'bi-patch-check', label: 'Issue', variant: 'primary', permission: 'a_certs.edit' });
      if (c.status === 'Pending') list.push({ key: 'reject', icon: 'bi-x-circle', label: 'Reject', variant: 'danger', permission: 'a_certs.edit' });
      list.push({ key: 'delete', icon: 'bi-trash3-fill', label: 'Delete', variant: 'danger', permission: 'a_certs.delete' });
    }
    return list;
  }

  add(): void {
    this.openDialog(CertificateForm, {}, '520px');
  }

  async onQuickAction(e: { row: TableRow; action: string }): Promise<void> {
    const cert = this.store.items().find(c => c.id === Number(e.row['id']));
    if (!cert) return;
    switch (e.action) {
      case 'view': return this.actions.preview(cert);
      case 'download': return this.store.download(cert);
      case 'edit': this.openDialog(CertificateEditForm, cert, '820px'); return;
      case 'issue': await this.actions.issue(cert); return;
      case 'reject': await this.actions.reject(cert); return;
      case 'cancel': await this.actions.cancel(cert); return;
      case 'delete': await this.actions.delete(cert); return;
    }
  }
}
