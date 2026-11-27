import { UsersService } from '../../../shared/common-services/users.service';
import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { AssessmentsApi } from '../../../shared/common-services/assessments-api.service';
import { AssessType } from '../../../shared/models/assessment.model';
import { CommonFilterCard } from '../../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../../shared/components/common-table-card/common-table-card';
import { CountRibbon } from '../../../shared/components/count-ribbon/count-ribbon';
import { LocalListBase } from '../../../shared/components/local-list-base';
import { RibbonItem, TableColumn, TableRow } from '../../../shared/models/common-components.model';
import { AttemptCounts, AttemptOutcome, OUTCOME_LABEL, QuizAttemptRow } from '../../../shared/models/quiz-attempt.model';
import { QuizAttemptDetail } from './quiz-attempt-detail';

const when = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const mmss = (sec: number | null): string => (sec === null ? '—' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
const time = (iso: string | null): number => (iso ? new Date(iso).getTime() : 0);

/** One student's attempts, newest first, as the expanded sub-table shows them. */
export interface AttemptLine {
  id: number;
  attemptNo: string;
  quiz: string;
  course: string;
  started: string;
  timeTaken: string;
  score: string;
  percent: string;
  outcome: AttemptOutcome;
  outcomeLabel: string;
}

/** A student's standing across all their attempts: passed if any attempt passed, otherwise how the latest one ended. */
export const overallOutcome = (attempts: QuizAttemptRow[]): AttemptOutcome =>
  attempts.some(a => a.outcome === 'passed') ? 'passed' : attempts[0].outcome;

/**
 * Quiz attempts, one row per student: how many attempts they made, their best result and standing, and a chevron that opens
 * every attempt of that student underneath. A row (or an attempt) opens the detail view with the exact questions served.
 * The API limits the rows to what the signed-in user may see (admins everyone, mentors their batch), so the same component
 * serves the admin Quiz tab and the mentor page. Set `embedded` to drop the page header inside a tab.
 */
@Component({
  selector: 'app-quiz-attempts',
  standalone: true,
  imports: [CommonFilterCard, CommonTableCard, CountRibbon],
  templateUrl: './quiz-attempts.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', './quiz-attempts.scss'],
})
export class QuizAttempts extends LocalListBase implements OnInit {
  private readonly users = inject(UsersService);
  private readonly api = inject(AssessmentsApi);

  /** Hide the page header when the list sits inside another page's tab. */
  @Input() embedded = false;
  /** Limit the list to quizzes or to assessments; all question-based attempts when unset. */
  @Input() type: AssessType | undefined;

  protected readonly noun = 'students';
  protected override filterFields = { status: 'outcome', source: 'outcome', branch: ['batch'] };

  override columns: TableColumn[] = [
    { key: 'expand', header: '', type: 'expand', width: '4%', minWidth: 56, sortable: false },
    { key: 'student', header: 'Student', type: 'lead', width: '22%', minWidth: 180 },
    { key: 'quizzes', header: 'Quizzes', width: '20%', minWidth: 150 },
    { key: 'attempts', header: 'No. of attempts', width: '10%', minWidth: 110 },
    { key: 'best', header: 'Best result', width: '9%' },
    { key: 'last', header: 'Last attempt', width: '15%', minWidth: 130 },
    { key: 'outcome', header: 'Status', type: 'badge', width: '10%' },
    { key: 'actions', header: 'Action', type: 'quickActions', width: '6%', sortable: false },
  ];
  override filters = [
    { key: 'status', label: 'Status', options: Object.values(OUTCOME_LABEL) },
    { key: 'date', label: 'Last attempt' },
  ];
  override sortActive = 'last';
  override sortDirection: 'asc' | 'desc' = 'desc';

  readonly items = signal<QuizAttemptRow[]>([]);
  readonly counts = signal<AttemptCounts | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Ids of the students whose attempts are open. */
  readonly expanded = signal<string[]>([]);

  /** Attempts grouped by student, each group newest first. */
  readonly groups = computed(() => {
    const byStudent = new Map<number, QuizAttemptRow[]>();
    for (const a of this.items()) {
      const id = a.student?.id ?? 0;
      byStudent.set(id, [...(byStudent.get(id) ?? []), a]);
    }
    for (const list of byStudent.values()) list.sort((x, y) => time(y.started_at) - time(x.started_at) || y.id - x.id);
    return byStudent;
  });

  readonly stats = computed<RibbonItem[]>(() => {
    const standing = [...this.groups().values()].map(overallOutcome);
    const n = (o: AttemptOutcome) => standing.filter(s => s === o).length;
    const tile = (label: string, value: number, icon: string, iconVariant: RibbonItem['iconVariant'], outcome?: AttemptOutcome): RibbonItem =>
      ({ label, value, icon, iconVariant, ...(outcome ? { filter: { key: 'status', value: OUTCOME_LABEL[outcome] } } : {}) });
    return [
      tile('Students', this.groups().size, 'bi-people-fill', 'blue'),
      tile('Attempts', this.counts()?.total ?? this.items().length, 'bi-clipboard-data', 'purple'),
      tile('Passed', n('passed'), 'bi-check-circle-fill', 'green', 'passed'),
      tile('Not passed', n('not_passed'), 'bi-x-circle-fill', 'orange', 'not_passed'),
      tile('Needs review', n('needs_review'), 'bi-hourglass-split', 'purple', 'needs_review'),
    ];
  });

  ngOnInit(): void { void this.load(); }

  protected allRows(): TableRow[] {
    return [...this.groups().entries()].map(([studentId, attempts]) => {
      const first = attempts[0];
      const quizzes = [...new Set(attempts.map(a => a.assessment?.title ?? 'Quiz'))];
      const best = Math.max(-1, ...attempts.filter(a => a.submitted_at && a.outcome !== 'timed_out' && a.result_percent !== null).map(a => Number(a.result_percent)));
      const overall = overallOutcome(attempts);
      return {
        id: String(studentId),
        student: { name: first.student?.name ?? 'Student', subtitle: first.student?.public_id ?? '', photo: this.users.photoOf(first.student?.public_id) },
        __student: first.student?.name ?? '',
        searchText: [first.student?.name, first.student?.public_id, ...quizzes, ...attempts.map(a => a.assessment?.course)].filter(Boolean).join(' '),
        quizzes: quizzes.length === 1 ? quizzes[0] : `${quizzes.length} quizzes`,
        __quizzes: quizzes.length,
        attempts: String(attempts.length),
        __attempts: attempts.length,
        best: best >= 0 ? `${best}%` : '—',
        __best: best,
        last: when(first.started_at),
        __last: first.started_at ?? '',
        __date: first.started_at ?? '',
        outcome: OUTCOME_LABEL[overall],
        actions: [{ key: 'open', icon: 'bi-eye-fill', label: 'View latest attempt', variant: 'primary' }],
      };
    });
  }

  /** The sub-table lines for one student row. */
  linesFor(row: TableRow): AttemptLine[] {
    return (this.groups().get(Number(row['id'])) ?? []).map(a => {
      const scored = a.marks !== null && a.total !== null && a.submitted_at !== null;
      return {
        id: a.id,
        attemptNo: `#${a.attempt_no}`,
        quiz: a.assessment?.title ?? 'Quiz',
        course: a.assessment?.course ?? '',
        started: when(a.started_at),
        timeTaken: mmss(a.time_taken_sec),
        score: scored ? `${a.marks} / ${a.total}` : '—',
        percent: scored ? `${a.result_percent}%` : '—',
        outcome: a.outcome,
        outcomeLabel: OUTCOME_LABEL[a.outcome],
      };
    });
  }

  toggle(row: TableRow): void {
    const id = String(row['id']);
    this.expanded.update(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.api.getQuizAttempts({ per_page: 100, ...(this.type ? { type: this.type.toLowerCase() } : {}) });
      this.items.set(res.attempts);
      this.counts.set(res.counts);
      this.refresh();
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  openAttempt(id: number): void {
    this.openDialog<QuizAttemptDetail, boolean>(QuizAttemptDetail, { attemptId: id }, '860px').afterClosed().subscribe(changed => { if (changed) void this.load(); });
  }

  /** The student's latest attempt, from the row. */
  openLatest(row: TableRow): void {
    const latest = this.groups().get(Number(row['id']))?.[0];
    if (latest) this.openAttempt(latest.id);
  }

  onQuickAction(e: { row: TableRow; action: string }): void {
    if (e.action === 'open') this.openLatest(e.row);
  }
}
