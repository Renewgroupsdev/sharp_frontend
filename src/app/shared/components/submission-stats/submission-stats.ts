import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { SubmissionStatsService } from '../../common-services/submission-stats.service';
import { SubmissionStats, WrittenCounts } from '../../models/submission-stats.model';
import { PieChart, PieSlice } from '../pie-chart/pie-chart';

interface StatCard { key: string; title: string; icon: string; unit: string; total: number; slices: PieSlice[] }

const SCOPE_TITLE: Record<SubmissionStats['scope'], string> = {
  own: 'My submissions',
  batch: 'Submissions from my batch',
  all: 'Submissions across the programme',
};

/** New / in review / graded / returned, the four states of an assignment or assessment submission. */
const written = (c: WrittenCounts): PieSlice[] => [
  { label: 'New', value: c.submitted },
  { label: 'In review', value: c.under_review },
  { label: 'Graded', value: c.graded },
  { label: 'Returned', value: c.returned },
];

/**
 * Submission counts for the signed-in role as four cards, each with its own pie: all submissions by kind, then quizzes
 * (passed, not passed, waiting for marking), assignments and assessments (new, in review, graded, returned). The API scopes
 * the numbers (own, batch or all), so the same cards sit on the student, mentor and admin dashboards. They stay hidden for
 * roles the API does not serve.
 */
@Component({
  selector: 'app-submission-stats',
  standalone: true,
  imports: [PieChart],
  templateUrl: './submission-stats.html',
  styleUrl: './submission-stats.scss',
})
export class SubmissionStatsCard implements OnInit {
  private readonly api = inject(SubmissionStatsService);

  readonly stats = signal<SubmissionStats | null>(null);

  readonly title = computed(() => (this.stats() ? SCOPE_TITLE[this.stats()!.scope] : ''));

  readonly cards = computed<StatCard[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const quiz = s.quiz;
    return [
      {
        key: 'all', title: 'All submissions', icon: 'bi-collection', unit: 'submissions', total: quiz.total + s.assignment.total + s.assessment.total,
        slices: [{ label: 'Quizzes', value: quiz.total }, { label: 'Assignments', value: s.assignment.total }, { label: 'Assessments', value: s.assessment.total }],
      },
      {
        key: 'quiz', title: 'Quizzes', icon: 'bi-patch-question', unit: 'attempts', total: quiz.total,
        slices: [{ label: 'Passed', value: quiz.passed ?? 0 }, { label: 'Not passed', value: quiz.not_passed ?? 0 }, { label: 'Awaiting marking', value: quiz.needs_review }],
      },
      { key: 'assignment', title: 'Assignments', icon: 'bi-journal-text', unit: 'submissions', total: s.assignment.total, slices: written(s.assignment) },
      {
        key: 'assessment', title: 'Assessments', icon: 'bi-clipboard-check', unit: 'attempts', total: s.assessment.total,
        slices: [{ label: 'Passed', value: s.assessment.passed ?? 0 }, { label: 'Not passed', value: s.assessment.not_passed ?? 0 }, { label: 'Awaiting marking', value: s.assessment.needs_review ?? 0 }],
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    try {
      this.stats.set(await this.api.load());
    } catch {
      this.stats.set(null); // a role the API does not serve (403), or the server is unreachable: show nothing
    }
  }
}
