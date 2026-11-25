import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssessmentsService } from '../../../shared/common-services/assessments.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ToastService } from '../../../shared/common-services/toast.service';
import { ASSESS_TYPES, AnswerSheetMode, AssessType, QuizSetup as QuizSetupModel, defaultSetup, usesQuestions } from '../../../shared/models/assessment.model';

type FlagKey = { [K in keyof QuizSetupModel]: QuizSetupModel[K] extends boolean ? K : never }[keyof QuizSetupModel];

/** Switches shown as a checkbox grid; adding an option is one line here. */
const FLAGS: { key: FlagKey; label: string }[] = [
  { key: 'review', label: 'Question review' },
  { key: 'random', label: 'Random questions' },
  { key: 'multi', label: 'Multiple attempts' },
  { key: 'samePage', label: 'Show all questions on the same page' },
  { key: 'expl', label: 'Show question & explanation' },
  { key: 'sheets', label: 'See answer sheets' },
  { key: 'score', label: 'See score report' },
  { key: 'total', label: 'Show total correct answers' },
];

const SHEET_MODES: { value: AnswerSheetMode; label: string }[] = [
  { value: 'correct', label: 'Show correct answers' },
  { value: 'wrong', label: 'Show only wrong answers' },
  { value: 'none', label: 'Don’t reveal answers' },
];

/** Quiz setup tab: timing, pass percentage, review and answer-sheet options of one quiz, assignment or assessment. */
@Component({
  selector: 'app-quiz-setup',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './quiz-setup.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', '../../../shared/styles/erp-dialog.scss', '../assess-dialog.scss', './quiz-setup.scss'],
})
export class QuizSetup {
  readonly store = inject(AssessmentsService);
  private readonly toast = inject(ToastService);

  readonly types = ASSESS_TYPES;
  readonly flags = FLAGS;
  readonly sheetModes = SHEET_MODES;

  /** Set by the Quiz / Assessment / Assignment tab: only that type is configured, so the type chips are hidden. */
  readonly fixedType = input<AssessType>();
  readonly type = linkedSignal<AssessType>(() => this.fixedType() ?? 'Quiz');
  private readonly pickedId = signal('');
  readonly items = computed(() => this.store.items().filter(a => a.type === this.type()));
  readonly selected = computed(() => this.items().find(a => a.id === this.pickedId()) ?? this.items()[0]);
  readonly isQuiz = computed(() => !!this.selected() && usesQuestions(this.selected()!.type));

  model: QuizSetupModel = defaultSetup();

  constructor() {
    effect(() => {
      this.model = { ...defaultSetup(), ...(this.selected()?.setup ?? {}), groups: [...(this.selected()?.setup?.groups ?? [])] };
    });
  }

  count(t: AssessType): number { return this.store.items().filter(a => a.type === t).length; }

  setType(t: AssessType): void {
    this.type.set(t);
    this.pickedId.set('');
  }

  pick(id: string): void { this.pickedId.set(id); }

  hasGroup(id: string): boolean { return this.model.groups.includes(id); }

  toggleGroup(id: string, on: boolean): void {
    this.model.groups = on ? [...this.model.groups, id] : this.model.groups.filter(g => g !== id);
  }

  async save(): Promise<void> {
    const it = this.selected();
    const m = this.model;
    if (!it) return;
    if (!(Number(m.perQ) >= 0)) return void this.toast.error('Time per question cannot be negative');
    if (this.isQuiz() && !(Number(m.minp) >= 0 && Number(m.minp) <= 100)) return void this.toast.error('Pass percentage must be between 0 and 100');
    if (!(Number(m.count) >= 0)) return void this.toast.error('Questions per student cannot be negative');
    try {
      await this.store.saveSetup(it.id, { ...m, perQ: Number(m.perQ), minp: Number(m.minp), count: Math.max(0, Math.floor(Number(m.count) || 0)) });
      this.toast.success('Setup saved');
    } catch (e) {
      this.toast.error(apiErrorMessage(e));
    }
  }
}
