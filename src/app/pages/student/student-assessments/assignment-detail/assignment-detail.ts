import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { apiErrorMessage } from '../../../../core/http/api.interceptor';
import { ToastService } from '../../../../shared/common-services/toast.service';
import { SubmissionFiles } from '../../../../shared/components/submission-files/submission-files';
import { AssessmentViewService } from '../../../../shared/common-services/assessment-view.service';
import { MyAssessmentsApi, MyAssessmentsService } from '../../../../shared/common-services/my-assessments.service';
import { AssessmentSubmission, MyAssessment } from '../../../../shared/models/my-assessment.model';

@Component({
  selector: 'app-assignment-detail', standalone: true, imports: [CommonModule, FormsModule, RouterLink, DatePipe, SubmissionFiles],
  templateUrl: './assignment-detail.html', styleUrls: ['../../../student/student.scss', './assignment-detail.scss'],
})
export class AssignmentDetailPage implements OnInit {
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

  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    if (selected.length > 5) { this.error.set('You can upload a maximum of 5 files per submission.'); input.value = ''; return; }
    if (selected.some(f => f.size > 20 * 1024 * 1024)) { this.error.set('Each file must be 20 MB or smaller.'); input.value = ''; return; }
    this.files.set(selected); this.error.set(null);
  }

  async submit(): Promise<void> {
    if (!this.content().trim() && !this.files().length) { this.error.set('Enter your answer or attach at least one file.'); return; }
    this.saving.set(true); this.error.set(null);
    try {
      const result = await this.api.submitAssignment(this.id, this.content(), this.files());
      this.submissions.update(items => [result, ...items]);
      this.store.items.update(items => items.map(item => item.id === this.id ? { ...item, latest_submission: { id: result.id, submission_no: result.submission_no, status: result.status, marks_obtained: result.marks_obtained, submitted_at: result.submitted_at } } : item));
      this.files.set([]); this.content.set('');
    } catch (e) { this.error.set(apiErrorMessage(e)); }
    finally { this.saving.set(false); }
  }

  statusLabel(status: string): string {
    return ({ submitted: 'Submitted', under_review: 'Under review', graded: 'Graded', returned: 'Returned for correction' } as Record<string, string>)[status] ?? status;
  }

  canSubmit(): boolean {
    const due = this.assessment()?.due_date;
    return !due || new Date(`${due}T23:59:59`).getTime() >= Date.now();
  }
}
