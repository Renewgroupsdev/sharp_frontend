import { UsersService } from '../../../shared/common-services/users.service';
import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ToastService } from '../../../shared/common-services/toast.service';
import { AssessmentsApi } from '../../../shared/common-services/assessments-api.service';
import { AttachmentPreviewService } from '../../../shared/common-services/attachment-preview.service';
import { CommonFilterCard } from '../../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../../shared/components/common-table-card/common-table-card';
import { CountRibbon } from '../../../shared/components/count-ribbon/count-ribbon';
import { LocalListBase } from '../../../shared/components/local-list-base';
import { ExportFormat, QuickAction, RibbonItem, TableColumn, TableRow } from '../../../shared/models/common-components.model';
import { AssessmentSubmission, SubmissionAttachment } from '../../../shared/models/my-assessment.model';
import { saveBlob } from '../../../shared/utils/export.util';
import { humanSize } from '../../../shared/utils/upload.util';

type PanelTab = 'details' | 'attachments' | 'history' | 'review' | 'logs';

const LABELS: Record<string, string> = { submitted: 'Submitted', under_review: 'Under review', graded: 'Graded', returned: 'Returned' };
/** The corner sash reuses the role-tag colours: one per status. */
const SASH: Record<string, string> = { submitted: 'role-admin', under_review: 'role-mentor', graded: 'role-student', returned: 'role-institution' };

const day = (iso: string | null | undefined): string => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * Assignment submissions: one row per student who handed in work (assignment, due date, submitted date, status, score and
 * the mentor's review). A row opens the grading panel on the right, laid out like the user details panel.
 */
@Component({
  selector: 'app-submissions', standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CommonFilterCard, CommonTableCard, CountRibbon],
  templateUrl: './submissions.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', './submissions.scss'],
})
export class SubmissionsPage extends LocalListBase implements OnInit {
  private readonly users = inject(UsersService);
  /** Hide the page header when the list sits inside the Submissions tabs. */
  @Input() embedded = false;

  private readonly api = inject(AssessmentsApi);
  private readonly preview = inject(AttachmentPreviewService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Saving a student's file is for Admin and Super Admin only; others can open files to review. */
  readonly canManage = computed(() => this.auth.hasActionAccess('a_assess.download'));
  /** Marks and reviews are the mentor's (and OB's) job; Admin and Super Admin can only read them. */
  readonly canGrade = computed(() => this.auth.hasActionAccess('a_assess.grade'));

  protected readonly noun = 'submissions';
  protected override filterFields = { status: 'status', source: 'assessmentTitle', branch: ['batch'] };

  override columns: TableColumn[] = [
    { key: 'student', header: 'Student', type: 'lead', width: '18%', minWidth: 180 },
    { key: 'assessment', header: 'Assessment', type: 'lead', width: '18%', minWidth: 170 },
    { key: 'due', header: 'Due date', width: '9%' },
    { key: 'submitted', header: 'Submitted', width: '10%' },
    { key: 'status', header: 'Status', type: 'badge', width: '9%' },
    { key: 'score', header: 'Score', width: '7%' },
    { key: 'review', header: 'Review', type: 'longText', width: '23%', minWidth: 220 },
    { key: 'actions', header: 'Action', type: 'quickActions', width: '6%', sortable: false },
  ];
  override filters = [
    { key: 'status', label: 'Status', options: Object.values(LABELS) },
    { key: 'source', label: 'Assessment', options: [] as string[] },
    { key: 'date', label: 'Submitted' },
  ];
  override sortActive = 'submitted';
  override sortDirection: 'asc' | 'desc' = 'desc';

  readonly items = signal<AssessmentSubmission[]>([]);
  readonly selected = signal<AssessmentSubmission | null>(null);
  readonly marks = signal<number | null>(null);
  readonly feedback = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly panelTab = signal<PanelTab>('details');
  readonly reviewStatus = signal<'under_review' | 'returned' | 'graded'>('under_review');
  readonly statusOptions = [
    { value: 'under_review' as const, label: 'Under review', hint: 'Still checking, no grade yet' },
    { value: 'returned' as const, label: 'Returned for correction', hint: 'Send back with feedback' },
    { value: 'graded' as const, label: 'Graded', hint: 'Save the score and finish' },
  ];

  readonly stats = computed<RibbonItem[]>(() => {
    const all = this.items();
    const n = (s: string) => all.filter(i => i.status === s).length;
    return [
      { label: 'Submissions', value: all.length, icon: 'bi-journal-check', iconVariant: 'blue' },
      { label: 'Waiting for review', value: n('submitted'), icon: 'bi-hourglass-split', iconVariant: 'orange', filter: { key: 'status', value: 'Submitted' } },
      { label: 'Under review', value: n('under_review'), icon: 'bi-eye', iconVariant: 'purple', filter: { key: 'status', value: 'Under review' } },
      { label: 'Graded', value: n('graded'), icon: 'bi-patch-check', iconVariant: 'green', filter: { key: 'status', value: 'Graded' } },
    ];
  });

  readonly sash = computed(() => SASH[this.selected()?.status ?? ''] ?? 'role-admin');
  /** Every version this student sent for this assessment, newest first. */
  readonly versions = computed(() => {
    const s = this.selected();
    if (!s) return [];
    return this.items().filter(i => i.assessment_id === s.assessment_id && i.student?.id === s.student?.id).sort((a, b) => b.submission_no - a.submission_no);
  });

  /** The whole conversation as comments, oldest first: each student's answer, then the mentor / admin review of that version. */
  readonly comments = computed(() => this.versions().slice().reverse().flatMap(v => {
    const marks = v.marks_obtained !== null && v.marks_obtained !== '' ? Number(v.marks_obtained) : null;
    const rows: { key: string; id: number; kind: 'student' | 'mentor'; name: string; role: string; version: number; at: string; text: string; marks: number | null; max: number; status: string }[] = [
      { key: `s${v.id}`, id: v.id, kind: 'student', name: v.student?.name ?? 'Student', role: 'Student', version: v.submission_no, at: v.submitted_at, text: v.content?.trim() || (v.attachments.length ? 'Answer sent as attached files.' : 'No written answer.'), marks: null, max: 0, status: v.status },
    ];
    if (v.feedback || v.status === 'graded' || v.status === 'returned') {
      rows.push({ key: `m${v.id}`, id: v.id, kind: 'mentor', name: v.grader?.name ?? 'Mentor', role: 'Mentor / Admin', version: v.submission_no, at: v.graded_at ?? v.submitted_at, text: v.feedback?.trim() || 'No written review.', marks, max: v.assessment?.max_marks ?? 0, status: v.status });
    }
    return rows;
  }));
  readonly answerComment = computed(() => this.comments().find(c => c.kind === 'student' && c.id === this.selected()?.id) ?? null);

  /** The files grouped by version, newest first. */
  readonly fileGroups = computed(() => this.versions().filter(v => v.attachments.length).map(v => ({ version: v.submission_no, at: v.submitted_at, files: v.attachments })));

  fileKind(f: SubmissionAttachment): string {
    const n = f.name.toLowerCase();
    return n.endsWith('.pdf') ? 'pdf' : /\.(png|jpe?g|gif|webp|svg)$/.test(n) ? 'img' : /\.(docx?|rtf|txt)$/.test(n) ? 'doc' : /\.(xlsx?|csv)$/.test(n) ? 'xls' : /\.(pptx?)$/.test(n) ? 'ppt' : /\.(ai|psd|fig|sketch)$/.test(n) ? 'design' : 'other';
  }
  fileIcon(f: SubmissionAttachment): string {
    return { pdf: 'bi-file-earmark-pdf', img: 'bi-file-earmark-image', doc: 'bi-file-earmark-word', xls: 'bi-file-earmark-excel', ppt: 'bi-file-earmark-slides', design: 'bi-vector-pen', other: 'bi-file-earmark' }[this.fileKind(f)] ?? 'bi-file-earmark';
  }

  async downloadAll(): Promise<void> {
    if (!this.canManage()) return;
    for (const r of this.fileRows()) await this.download(r.file);
  }

  /** The mentor's reviews: one per version that has been reviewed or graded. */
  readonly history = computed(() => this.versions()
    .filter(v => v.feedback || v.status === 'graded' || v.status === 'returned')
    .map(v => ({
      id: v.id, version: v.submission_no, grader: v.grader?.name ?? '', at: v.graded_at ?? v.submitted_at, feedback: v.feedback?.trim() ?? '',
      marks: v.marks_obtained !== null && v.marks_obtained !== '' ? Number(v.marks_obtained) : null, max: v.assessment?.max_marks ?? 0, status: v.status,
    })));

  /** The story of every version, oldest first: handed in, picked up, graded or returned. */
  readonly activity = computed(() => this.versions().slice().reverse().flatMap(v => {
    const rows = [{ text: `Version ${v.submission_no} submitted`, at: v.submitted_at, by: v.student?.name ?? 'Student' }];
    if (v.status === 'under_review') rows.push({ text: `Version ${v.submission_no} picked up for review`, at: v.graded_at ?? v.submitted_at, by: v.grader?.name ?? 'Mentor' });
    if (v.status === 'graded' || v.status === 'returned') {
      rows.push({ text: v.status === 'graded' ? `Version ${v.submission_no} graded ${v.marks_obtained ?? ''} / ${v.assessment?.max_marks ?? ''}` : `Version ${v.submission_no} returned for correction`, at: v.graded_at ?? v.submitted_at, by: v.grader?.name ?? 'Mentor' });
    }
    return rows;
  }));

  /** Every file this student sent for this assessment, newest version first: version, date handed in, file. */
  readonly fileRows = computed(() => {
    const s = this.selected();
    if (!s) return [];
    return this.items()
      .filter(i => i.assessment_id === s.assessment_id && i.student?.id === s.student?.id)
      .sort((a, b) => b.submission_no - a.submission_no)
      .flatMap(i => i.attachments.map(f => ({ version: i.submission_no, at: i.submitted_at, file: f })));
  });
  readonly fileError = signal<string | null>(null);

  sizeOf(f: SubmissionAttachment): string { return humanSize(f.size); }

  view(f: SubmissionAttachment): void {
    this.preview.open({ name: f.name, size: this.sizeOf(f), mime: f.mime_type, load: () => this.api.viewAttachment(f.id) });
  }

  async download(f: SubmissionAttachment): Promise<void> {
    if (!this.canManage()) return;
    this.fileError.set(null);
    try { saveBlob(await this.api.downloadAttachment(f.id), f.name); }
    catch (e) { this.fileError.set(apiErrorMessage(e)); }
  }

  protected photoOf(id: string | undefined): string { return this.users.photoOf(id); }

  ngOnInit(): void { void this.load(); }

  protected allRows(): TableRow[] {
    return this.items().map(s => {
      const hasMarks = s.marks_obtained !== null && s.marks_obtained !== '';
      const title = s.assessment?.title || 'Assignment';
      return {
        id: String(s.id),
        student: { name: s.student?.name || 'Student', subtitle: `${s.student?.public_id ?? ''} · v${s.submission_no}`, photo: this.users.photoOf(s.student?.public_id) },
        __student: s.student?.name ?? '',
        assessment: { name: title, subtitle: s.assessment?.course ?? '' },
        assessmentTitle: title,
        __assessment: title,
        searchText: [s.student?.name, s.student?.public_id, title, s.assessment?.course, s.feedback].filter(Boolean).join(' '),
        due: day(s.assessment?.due_date),
        __due: s.assessment?.due_date ?? '',
        submitted: day(s.submitted_at),
        __submitted: s.submitted_at,
        __date: s.submitted_at,
        status: LABELS[s.status] ?? s.status,
        score: hasMarks ? `${s.marks_obtained} / ${s.assessment?.max_marks ?? '—'}` : '—',
        __score: hasMarks ? Number(s.marks_obtained) : -1,
        review: s.feedback?.trim() || '—',
        actions: [{ key: 'open', icon: 'bi-eye-fill', label: 'Review submission', variant: 'primary' }] as QuickAction[],
      };
    });
  }

  async load(): Promise<void> {
    this.loading.set(true); this.error.set(null);
    try {
      this.items.set((await this.api.getSubmissions({ per_page: 100 })).submissions);
      const titles = [...new Set(this.items().map(i => i.assessment?.title).filter((t): t is string => !!t))].sort();
      this.filters = this.filters.map(f => (f.key === 'source' ? { ...f, options: titles } : f));
    } catch (e) { this.error.set(apiErrorMessage(e)); }
    finally { this.loading.set(false); }
  }

  /** A row (or its student name) opens the panel. */
  open(row: TableRow): void {
    const item = this.items().find(i => String(i.id) === String(row['id']));
    if (item) this.select(item);
  }

  onQuickAction(e: { row: TableRow; action: string }): void { if (e.action === 'open') this.open(e.row); }
  onExport(format: ExportFormat): void { this.exportAs(format, 'sharp-submissions', 'Submissions'); }

  select(item: AssessmentSubmission): void {
    this.selected.set(item);
    this.panelTab.set('details');

    const marks = item.marks_obtained;
    const parsedMarks = marks === null || marks === '' ? null : Number(marks);
    this.marks.set(parsedMarks !== null && Number.isFinite(parsedMarks) ? parsedMarks : null);
    this.feedback.set(item.feedback ?? '');
    this.reviewStatus.set(item.status === 'graded' || item.status === 'returned' ? item.status : 'under_review');
  }

  close(): void { this.selected.set(null); }

  words(text: string | null): number { return (text ?? '').trim().split(/\s+/).filter(Boolean).length; }
  statusLabel(status: string): string { return LABELS[status] ?? status; }
  initials(name?: string): string { return (name ?? '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join(''); }
  badgeTone(status: string): string { return status === 'graded' ? 'ok' : status === 'returned' ? 'bad' : 'wait'; }

  private replace(result: AssessmentSubmission): void {
    this.items.update(rows => rows.map(row => row.id === result.id ? result : row));
    this.selected.set(result);
  }

  /** Applies the status chosen with the radio buttons. */
  async saveReview(): Promise<void> {
    const status = this.reviewStatus();
    if (status === 'under_review') await this.markUnderReview(); else await this.grade(status);
  }

  async markUnderReview(): Promise<void> {
    const item = this.selected(); if (!item) return;
    this.saving.set(true); this.error.set(null);
    try { this.replace((await this.api.markSubmissionUnderReview(item.id)).submission); }
    catch (e) { this.error.set(apiErrorMessage(e)); } finally { this.saving.set(false); }
  }

  async grade(status: 'graded' | 'returned'): Promise<void> {
    const item = this.selected();
    if (!item || this.marks() === null) { this.error.set('Enter the marks awarded.'); return; }
    this.saving.set(true); this.error.set(null);
    try { this.replace((await this.api.gradeSubmission(item.id, { marks_obtained: Number(this.marks()), feedback: this.feedback(), status })).submission); }
    catch (e) { this.error.set(apiErrorMessage(e)); }
    finally { this.saving.set(false); }
  }
}
