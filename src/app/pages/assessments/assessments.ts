import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AssessmentsService } from '../../shared/common-services/assessments.service';
import { AssessType } from '../../shared/models/assessment.model';
import { AssessmentList } from './assessment-list/assessment-list';
import { QuestionBank } from './question-bank/question-bank';
import { QuestionGroups } from './question-groups/question-groups';
import { QuizAttempts } from './quiz-attempts/quiz-attempts';
import { QuizReport } from './quiz-report/quiz-report';
import { QuizSetup } from './quiz-setup/quiz-setup';

type Kind = 'all' | AssessType;
type SubKey = 'list' | 'groups' | 'bank' | 'report' | 'attempts' | 'setup';

const QUESTION_SUBS = [
  { key: 'list' as SubKey, label: 'List', icon: 'bi-list-ul' },
  { key: 'groups' as SubKey, label: 'Question groups', icon: 'bi-collection' },
  { key: 'bank' as SubKey, label: 'Question bank', icon: 'bi-patch-question' },
  { key: 'report' as SubKey, label: 'Report', icon: 'bi-bar-chart-line' },
  { key: 'attempts' as SubKey, label: 'Attempts', icon: 'bi-clipboard-data' },
  { key: 'setup' as SubKey, label: 'Settings', icon: 'bi-sliders' },
] as const;

const LIST_AND_SETTINGS = [
  { key: 'list' as SubKey, label: 'List', icon: 'bi-list-ul' },
  { key: 'setup' as SubKey, label: 'Settings', icon: 'bi-sliders' },
] as const;

/** Top-level tabs: the full library, then one tab per kind with its own sub-tabs. */
const KINDS: { key: Kind; label: string; icon: string; subs: readonly { key: SubKey; label: string; icon: string }[] }[] = [
  { key: 'all', label: 'All', icon: 'bi-collection', subs: [] },
  {
    key: 'Quiz', label: 'Quiz', icon: 'bi-question-circle',
    subs: [
      { key: 'list', label: 'Quizzes', icon: 'bi-list-ul' },
      { key: 'groups', label: 'Question groups', icon: 'bi-collection' },
      { key: 'bank', label: 'Question bank', icon: 'bi-patch-question' },
      { key: 'report', label: 'Quiz report', icon: 'bi-bar-chart-line' },
      { key: 'attempts', label: 'Attempts', icon: 'bi-clipboard-data' },
      { key: 'setup', label: 'Settings', icon: 'bi-sliders' },
    ],
  },
  { key: 'Assessment', label: 'Assessment', icon: 'bi-patch-check', subs: QUESTION_SUBS },
  { key: 'Assignment', label: 'Assignment', icon: 'bi-journal-text', subs: LIST_AND_SETTINGS },
];

/**
 * Assessment Library: quizzes, assessments and assignments are built once here and then used course by course, module by
 * module and topic by topic. "All" lists everything with filters; each kind has its own tab with the tools that belong to it.
 */
@Component({
  selector: 'app-assessments',
  standalone: true,
  imports: [AssessmentList, QuestionGroups, QuestionBank, QuizReport, QuizAttempts, QuizSetup],
  templateUrl: './assessments.html',
  styleUrls: ['../../shared/styles/erp-page.scss', './assessments.scss'],
})
export class Assessments {
  private readonly store = inject(AssessmentsService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  /** Set by the Course Management sub-menu routes (Assignments / Assessments / Quiz): the page is pinned to that type. */
  readonly pinned = this.route.snapshot.data['kind'] as AssessType | undefined;
  readonly meta = this.pinned ? KINDS.find(k => k.key === this.pinned) : undefined;

  readonly subtitles: Record<string, string> = {
    Assignment: 'Work learners submit by a date, with marks and an optional document.',
    Assessment: 'Question-based assessments: shuffled per student, auto-marked, with long answers marked by a mentor.',
    Quiz: 'Quizzes built from question groups, with banks, reports and settings.',
  };
  readonly kinds = KINDS;
  readonly kind = signal<Kind>(this.pinned ?? 'all');
  readonly sub = signal<SubKey>('list');
  /** The sub-tabs of the current kind. Attempts needs its own permission (a_attempts.view). */
  readonly subs = computed<readonly { key: SubKey; label: string; icon: string }[]>(() =>
    (KINDS.find(k => k.key === this.kind())?.subs ?? []).filter(s => s.key !== 'attempts' || this.auth.can('a_attempts', 'v')));
  /** The type a tab is pinned to; undefined on "All". */
  readonly type = computed(() => (this.kind() === 'all' ? undefined : (this.kind() as AssessType)));

  count(k: Kind): number {
    const all = this.store.items();
    return k === 'all' ? all.length : all.filter(a => a.type === k).length;
  }

  pickKind(k: Kind): void {
    this.kind.set(k);
    this.sub.set('list');
  }
}
