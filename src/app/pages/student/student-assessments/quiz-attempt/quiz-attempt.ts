import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../../core/http/api.interceptor';
import { MyAssessmentsApi } from '../../../../shared/common-services/my-assessments.service';
import { ToastService } from '../../../../shared/common-services/toast.service';
import { AnswerValue, MyAssessmentDetail, QuizOutcome, ServedQuestion, StartedAttempt, SubmittedAnswer } from '../../../../shared/models/my-assessment.model';

type Phase = 'loading' | 'intro' | 'running' | 'result' | 'error';

/** What the student has entered, by question: choice indexes, the item order, the left→right matches, or text. */
type Draft = number[] | string[] | Record<string, string> | string;

const KEY = (attemptId: number) => `sharp.quiz.${attemptId}`;

/**
 * One quiz attempt from start to result: an intro with the rules and earlier attempts, the questions (one per page or
 * all on one page, as the quiz is set up) with a countdown when it is timed, and the result. Marking is done by the
 * server; this screen only collects answers. Answers are kept in session storage so a refresh does not lose them.
 */
@Component({
  selector: 'app-quiz-attempt',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './quiz-attempt.html',
  styleUrls: ['../../../../shared/styles/erp-page.scss', '../../student.scss', './quiz-attempt.scss'],
})
export class QuizAttempt implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(MyAssessmentsApi);
  private readonly toast = inject(ToastService);

  protected readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly phase = signal<Phase>('loading');
  readonly error = signal<string | null>(null);
  readonly detail = signal<MyAssessmentDetail | null>(null);
  readonly attempt = signal<StartedAttempt['attempt'] | null>(null);
  readonly questions = signal<ServedQuestion[]>([]);
  readonly answers = signal<Record<number, Draft>>({});
  readonly touched = signal<ReadonlySet<number>>(new Set());
  readonly index = signal(0);
  readonly remaining = signal<number | null>(null);
  readonly busy = signal(false);
  readonly outcome = signal<QuizOutcome | null>(null);

  private timer?: ReturnType<typeof setInterval>;
  private autoSubmitted = false;

  readonly info = computed(() => this.detail()?.assessment ?? null);
  readonly samePage = computed(() => this.info()?.same_page ?? false);
  readonly current = computed(() => this.questions()[this.index()]);
  readonly unanswered = computed(() => this.questions().filter(q => !this.isAnswered(q)).length);
  readonly canStart = computed(() => {
    const a = this.info();
    if (!a || a.type === 'assignment') return false;
    return !!this.detail()?.in_progress || a.attempts_allowed === null || (a.attempts_used ?? 0) < a.attempts_allowed;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
    // Keep the draft across a refresh.
    effect(() => {
      const at = this.attempt();
      if (this.phase() !== 'running' || !at) return;
      try { sessionStorage.setItem(KEY(at.id), JSON.stringify({ answers: this.answers(), touched: [...this.touched()], index: this.index() })); } catch { /* storage blocked */ }
    });
  }

  ngOnInit(): void {
    void this.loadIntro();
  }

  async loadIntro(): Promise<void> {
    this.phase.set('loading');
    try {
      this.detail.set(await this.api.detail(this.id));
      this.phase.set('intro');
    } catch (e) {
      this.fail(e);
    }
  }

  async begin(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const res = await this.api.start(this.id);
      this.attempt.set(res.attempt);
      this.questions.set(res.questions);
      this.restore(res);
      this.index.set(Math.min(this.index(), res.questions.length - 1));
      this.autoSubmitted = false;
      this.phase.set('running');
      this.startTimer(res.attempt.expires_at);
    } catch (e) {
      this.toast.error('Could not start the quiz', apiErrorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  /** Blank answers for a new attempt, or the draft saved for this attempt. */
  private restore(res: StartedAttempt): void {
    const blank: Record<number, Draft> = {};
    for (const q of res.questions) blank[q.id] = this.blank(q);
    this.answers.set(blank);
    this.touched.set(new Set());
    this.index.set(0);
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY(res.attempt.id)) ?? 'null') as { answers: Record<number, Draft>; touched: number[]; index: number } | null;
      if (saved) {
        this.answers.set({ ...blank, ...saved.answers });
        this.touched.set(new Set(saved.touched));
        this.index.set(saved.index ?? 0);
      }
    } catch { /* no usable draft */ }
  }

  private blank(q: ServedQuestion): Draft {
    switch (q.type) {
      case 'multiple_choice': return [];
      case 'sorting': return [...(q.items ?? [])];
      case 'matching': return {};
      default: return '';
    }
  }

  /* ---------- timer ---------- */

  private startTimer(expiresAt: string | null): void {
    this.stopTimer();
    if (!expiresAt) return void this.remaining.set(null);
    const deadline = new Date(expiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      this.remaining.set(left);
      if (left === 0 && this.phase() === 'running' && !this.autoSubmitted) {
        this.autoSubmitted = true;
        void this.submit(true);
      }
    };
    tick();
    this.timer = setInterval(tick, 1000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** "12:05" or "1:02:03". */
  clock(sec: number | null): string {
    if (sec === null) return '';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  /** "45 min", "1 h 10 min". */
  minutes(sec: number | null): string {
    if (!sec) return 'Untimed';
    const m = Math.round(sec / 60);
    return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
  }

  /* ---------- answering ---------- */

  private touch(q: ServedQuestion): void {
    this.touched.update(s => new Set(s).add(q.id));
  }

  private set(q: ServedQuestion, value: Draft): void {
    this.answers.update(a => ({ ...a, [q.id]: value }));
    this.touch(q);
  }

  choices(q: ServedQuestion): number[] { return this.answers()[q.id] as number[]; }

  isChosen(q: ServedQuestion, i: number): boolean { return this.choices(q).includes(i); }

  choose(q: ServedQuestion, i: number, on: boolean): void {
    this.set(q, q.multiple ? (on ? [...this.choices(q), i] : this.choices(q).filter(x => x !== i)) : [i]);
  }

  order(q: ServedQuestion): string[] { return this.answers()[q.id] as string[]; }

  move(q: ServedQuestion, from: number, by: number): void {
    const list = [...this.order(q)], to = from + by;
    if (to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    this.set(q, list);
  }

  matchOf(q: ServedQuestion, left: string): string { return (this.answers()[q.id] as Record<string, string>)[left] ?? ''; }

  match(q: ServedQuestion, left: string, right: string): void {
    this.set(q, { ...(this.answers()[q.id] as Record<string, string>), [left]: right });
  }

  text(q: ServedQuestion): string { return this.answers()[q.id] as string; }

  write(q: ServedQuestion, value: string): void { this.set(q, value); }

  words(value: string): number { return value.trim() ? value.trim().split(/\s+/).length : 0; }

  isAnswered(q: ServedQuestion): boolean {
    const v = this.answers()[q.id];
    switch (q.type) {
      case 'multiple_choice': return ((v as number[] | undefined)?.length ?? 0) > 0;
      case 'sorting': return this.touched().has(q.id);
      case 'matching': return Object.values((v as Record<string, string>) ?? {}).some(Boolean);
      default: return !!(v as string | undefined)?.trim();
    }
  }

  go(i: number): void { this.index.set(Math.max(0, Math.min(this.questions().length - 1, i))); }

  /* ---------- submit ---------- */

  private payload(): SubmittedAnswer[] {
    return this.questions().map(q => {
      const v = this.answers()[q.id];
      let answer: AnswerValue = null;
      if (this.isAnswered(q)) {
        answer = q.type === 'matching' ? Object.entries(v as Record<string, string>).filter(([, r]) => r).map(([l, r]) => [l, r]) : (v as AnswerValue);
      }
      return { question_id: q.id, answer };
    });
  }

  async submit(auto = false): Promise<void> {
    const at = this.attempt();
    if (!at || this.busy()) return;
    if (!auto && this.unanswered() > 0
      && !(await this.toast.confirm('Submit with unanswered questions?', `${this.unanswered()} question(s) have no answer. They will score zero.`, 'Yes, submit'))) return;

    this.busy.set(true);
    try {
      this.outcome.set(await this.api.submit(this.id, at.id, this.payload()));
      this.stopTimer();
      try { sessionStorage.removeItem(KEY(at.id)); } catch { /* storage blocked */ }
      this.phase.set('result');
      if (auto) this.toast.error('Time is up', 'Your answers were submitted automatically.');
    } catch (e) {
      this.toast.error('Could not submit', apiErrorMessage(e));
      if (auto) { this.stopTimer(); await this.loadIntro(); }
    } finally {
      this.busy.set(false);
    }
  }

  retry(): void {
    this.outcome.set(null);
    this.attempt.set(null);
    void this.loadIntro();
  }

  review(): void {
    void this.router.navigate(['/app/assessments', this.id, 'review'], { queryParams: { attempt: this.outcome()?.attempt_id } });
  }

  /** Warn before a refresh or close would lose a running attempt. */
  @HostListener('window:beforeunload', ['$event'])
  protected guard(event: BeforeUnloadEvent): void {
    if (this.phase() === 'running') event.preventDefault();
  }

  private fail(e: unknown): void {
    this.error.set(apiErrorMessage(e));
    this.phase.set('error');
  }
}
