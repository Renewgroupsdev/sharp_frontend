import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { apiErrorMessage } from '../../../../core/http/api.interceptor';
import { ToastService } from '../../../../shared/common-services/toast.service';
import { SubmissionFiles } from '../../../../shared/components/submission-files/submission-files';
import { AssessmentViewService } from '../../../../shared/common-services/assessment-view.service';
import { MyAssessmentsApi, MyAssessmentsService } from '../../../../shared/common-services/my-assessments.service';
import { DOCUMENT_ACCEPT, documentProblem, fileKind } from '../../../../shared/utils/upload.util';
import { AssessmentSubmission, MyAssessment } from '../../../../shared/models/my-assessment.model';

@Component({
  selector: 'app-assignment-detail', standalone: true, imports: [CommonModule, FormsModule, RouterLink, DatePipe, SubmissionFiles],
  templateUrl: './assignment-detail.html', styleUrls: ['../../../student/student.scss', './assignment-detail.scss'],
})
export class AssignmentDetailPage implements OnInit, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly previews = new Map<File, { raw: string; safe: SafeUrl }>();
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(MyAssessmentsApi);
  private readonly store = inject(MyAssessmentsService);
  private readonly viewer = inject(AssessmentViewService);
  private readonly toast = inject(ToastService);
  readonly assessment = signal<MyAssessment | null>(null);
  readonly submissions = signal<AssessmentSubmission[]>([]);
  readonly content = signal('');
  readonly files = signal<File[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedNames = computed(() => this.files().map(f => f.name));
  private id = 0;

  async ngOnInit(): Promise<void> {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    try {
      const [detail, submissions] = await Promise.all([this.api.detail(this.id), this.api.assignmentSubmissions(this.id)]);
      this.assessment.set(detail.assessment);
      this.submissions.set(submissions);
      this.content.set(submissions[0]?.status === 'returned' ? (submissions[0].content ?? '') : '');
    } catch (e) { this.error.set(apiErrorMessage(e)); }
    finally { this.loading.set(false); }
  }

  viewDocument(): void {
    const a = this.assessment();
    if (a) this.viewer.openStudent(a);
  }

  readonly dragOver = signal(false);
  private readonly openNotes = signal<ReadonlySet<number>>(new Set());
  isOpen(id: number): boolean { return this.openNotes().has(id); }
  toggle(id: number): void { this.openNotes.update(s => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; }); }
  readonly accept = DOCUMENT_ACCEPT;
  readonly fileError = signal<string | null>(null);
  readonly previewing = signal<File | null>(null);
  readonly kind = fileKind;

  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  /** Adds picked files to the ones already chosen, within the 5 file limit and the per-file size limits. */
  private addFiles(picked: File[]): void {
    if (!picked.length) return;
    this.fileError.set(null);
    const bad = picked.map(f => { const p = documentProblem(f); return p ? `${f.name}: ${p}` : null; }).find(p => p !== null);
    if (bad) { this.fileError.set(bad); return; }
    const all = [...this.files(), ...picked.filter(p => !this.files().some(f => f.name === p.name && f.size === p.size))];
    if (all.length > 5) { this.fileError.set('You can upload a maximum of 5 files per submission.'); return; }
    this.files.set(all);
    this.error.set(null);
  }

  removeFile(i: number): void {
    const gone = this.files()[i];
    if (gone) this.dropPreview(gone);
    if (this.previewing() === gone) this.previewing.set(null);
    this.files.update(list => list.filter((_, idx) => idx !== i));
  }

  /** Local preview link for a chosen file (made once per file, released on remove, submit or leaving the page). */
  previewOf(f: File): SafeUrl {
    let p = this.previews.get(f);
    if (!p) {
      const raw = URL.createObjectURL(f);
      p = { raw, safe: this.sanitizer.bypassSecurityTrustUrl(raw) };
      this.previews.set(f, p);
    }
    return p.safe;
  }

  kindOf(f: File): 'video' | 'image' | 'other' {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    return ['mp4', 'webm', 'mov'].includes(ext) ? 'video' : ['jpg', 'jpeg', 'png'].includes(ext) ? 'image' : 'other';
  }

  private dropPreview(f: File): void {
    const p = this.previews.get(f);
    if (p) { URL.revokeObjectURL(p.raw); this.previews.delete(f); }
  }

  ngOnDestroy(): void { for (const f of [...this.previews.keys()]) this.dropPreview(f); }

  sizeOf(f: File): string { return f.size < 1048576 ? Math.max(1, Math.round(f.size / 1024)) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB'; }

  /** Whole days until the due date (negative once passed), or null when there is no deadline. */
  daysLeft(): number | null {
    const due = this.assessment()?.due_date;
    if (!due) return null;
    return Math.ceil((new Date(`${due}T23:59:59`).getTime() - Date.now()) / 86400000);
  }

  daysLeftText(): string {
    const d = this.daysLeft();
    if (d === null) return '';
    return d < 0 ? 'Closed' : d === 0 ? 'Due today' : d === 1 ? '1 day left' : `${d} days left`;
  }

  /** The badge in the page header: where the student stands with this assignment. */
  private latestStatus(): string | undefined { return this.submissions()[0]?.status; }
  stateText(): string {
    const s = this.latestStatus();
    return s ? this.statusLabel(s) : this.canSubmit() ? 'Not submitted' : 'Closed';
  }
  stateTone(): string {
    const s = this.latestStatus();
    return s === 'graded' ? 'g' : s === 'returned' || (!s && this.canSubmit()) ? 'w' : !s ? 'd' : '';
  }
  stateIcon(): string {
    const s = this.latestStatus();
    return s === 'graded' ? 'bi-check-circle-fill' : s ? 'bi-hourglass-split' : 'bi-pencil-square';
  }

  async submit(): Promise<void> {
    if (!this.content().trim() && !this.files().length) { this.error.set('Enter your answer or attach at least one file.'); return; }
    this.saving.set(true); this.error.set(null);
    try {
      const result = await this.api.submitAssignment(this.id, this.content(), this.files());
      this.submissions.update(items => [result, ...items]);
      this.store.items.update(items => items.map(item => item.id === this.id ? { ...item, latest_submission: { id: result.id, submission_no: result.submission_no, status: result.status, marks_obtained: result.marks_obtained, submitted_at: result.submitted_at } } : item));
      this.files().forEach(f => this.dropPreview(f));
      this.files.set([]); this.content.set('');
    } catch (e) { this.error.set(apiErrorMessage(e)); }
    finally { this.saving.set(false); }
  }

  /** A version can be taken back while it is waiting (submitted or returned) and the deadline is open. */
  canDelete(item: AssessmentSubmission): boolean {
    return (item.status === 'submitted' || item.status === 'returned') && this.canSubmit();
  }

  async deleteVersion(item: AssessmentSubmission): Promise<void> {
    if (!(await this.toast.confirm('Delete this version?', `Version ${item.submission_no} and its files will be removed.`, 'Yes, delete it'))) return;
    try {
      await this.api.deleteSubmission(this.id, item.id);
      this.submissions.update(list => list.filter(s => s.id !== item.id));
      const latest = this.submissions()[0];
      this.store.items.update(items => items.map(a => a.id === this.id ? { ...a, latest_submission: latest ? { id: latest.id, submission_no: latest.submission_no, status: latest.status, marks_obtained: latest.marks_obtained, submitted_at: latest.submitted_at } : null } : a));
      this.toast.success('Version deleted');
    } catch (e) { this.error.set(apiErrorMessage(e)); }
  }

  statusLabel(status: string): string {
    return ({ submitted: 'Submitted', under_review: 'Under review', graded: 'Graded', returned: 'Returned for correction' } as Record<string, string>)[status] ?? status;
  }

  canSubmit(): boolean {
    const due = this.assessment()?.due_date;
    return !due || new Date(`${due}T23:59:59`).getTime() >= Date.now();
  }
}
