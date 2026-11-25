import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AssessmentsService, NEW_GROUP, QuestionInput } from '../../../shared/common-services/assessments.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ToastService } from '../../../shared/common-services/toast.service';
import { AssessType, QUESTION_TYPES, QuestionData, QuestionType } from '../../../shared/models/assessment.model';

const OPTION_SLOTS = 6;
const lines = (text: string): string[] => text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);

/** Add / edit a question-bank question; the answer fields change with the question type. */
@Component({
  selector: 'app-question-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule],
  templateUrl: './question-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', '../assess-dialog.scss'],
})
export class QuestionForm {
  private readonly dialogRef = inject(MatDialogRef<QuestionForm, boolean>);
  private readonly data = inject<{ id?: string; type: AssessType }>(MAT_DIALOG_DATA);
  private readonly store = inject(AssessmentsService);
  private readonly toast = inject(ToastService);

  readonly types = QUESTION_TYPES;
  readonly newGroup = NEW_GROUP;
  readonly slots = Array.from({ length: OPTION_SLOTS }, (_, i) => i);
  readonly noun = this.data.type.toLowerCase();
  readonly groups = computed(() => this.store.groupsOf(this.data.type));
  readonly existing = this.data.id ? this.store.questions.get(this.data.id) : undefined;
  readonly isEdit = !!this.existing;
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly saving = signal(false);

  model = this.initial();

  private initial() {
    const q = this.existing, d: QuestionData = q?.data ?? {};
    return {
      gid: q?.gid ?? this.groups()[0]?.id ?? NEW_GROUP,
      newGroup: '',
      type: (q?.type ?? 'Multiple choice') as QuestionType,
      marks: q?.marks ?? 1,
      q: q?.q ?? '',
      image: q?.image ?? '',
      opts: this.slots.map(i => d.opts?.[i] ?? ''),
      correct: this.slots.map(i => !!d.correct?.includes(i)),
      sortItems: (d.items ?? []).join('\n'),
      pairs: (d.pairs ?? []).map(p => `${p[0]} = ${p[1]}`).join('\n'),
      puzzle: d.puzzle ?? '',
      hint: d.hint ?? '',
      shortAns: d.shortAns ?? '',
      keywords: d.keywords ?? '',
      rubric: d.rubric ?? '',
      wordlimit: d.wordlimit ?? 150,
      expl: q?.expl ?? '',
    };
  }

  close(): void { this.dialogRef.close(false); }

  onImage(event: Event): void {
    const input = event.target as HTMLInputElement, file = input.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) {
      input.value = '';
      return this.toast.error('Image must be under 200 KB');
    }
    const reader = new FileReader();
    reader.onload = () => (this.model.image = String(reader.result));
    reader.readAsDataURL(file);
  }

  /** Answer data for the chosen type, or an error message when the answer fields are incomplete. */
  private buildData(): QuestionData | string {
    const m = this.model;
    switch (m.type) {
      case 'Multiple choice': {
        const kept = m.opts.map((text, i) => ({ text: text.trim(), i })).filter(o => o.text);
        if (kept.length < 2) return 'Add at least two options';
        const correct = kept.map((o, k) => (m.correct[o.i] ? k : -1)).filter(k => k >= 0);
        if (!correct.length || m.correct.some((on, i) => on && !m.opts[i].trim())) return 'Tick the correct answer(s) among the filled options';
        return { opts: kept.map(o => o.text), correct };
      }
      case 'Sorting': {
        const items = lines(m.sortItems);
        return items.length < 2 ? 'Add at least two items, one per line' : { items };
      }
      case 'Matching': {
        const pairs = lines(m.pairs).map(l => l.split('=').map(x => x.trim())).filter(p => p.length === 2 && p[0] && p[1]);
        return pairs.length < 2 ? 'Add at least two pairs as “Left = Right”' : { pairs };
      }
      case 'Puzzle':
        return m.puzzle.trim() ? { puzzle: m.puzzle.trim(), hint: m.hint.trim() } : 'Enter the answer word or phrase';
      case 'Short answer':
        return m.shortAns.trim() ? { shortAns: m.shortAns.trim(), keywords: m.keywords.trim() } : 'Enter the model answer';
      default:
        return m.rubric.trim() ? { rubric: m.rubric.trim(), wordlimit: Number(m.wordlimit) || 150 } : 'Enter the marking guide';
    }
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    const m = this.model;
    if (!m.q.trim()) return;
    if (m.gid === NEW_GROUP && !m.newGroup.trim()) return this.serverError.set('Enter a title for the new group');
    const data = this.buildData();
    if (typeof data === 'string') return this.serverError.set(data);
    const input: QuestionInput = {
      gid: m.gid, groupType: this.data.type, newGroup: m.newGroup.trim(), type: m.type, marks: Number(m.marks) || 1, q: m.q.trim(), image: m.image, data, expl: m.expl.trim(),
    };
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.saveQuestion(input, this.existing?.id);
      this.toast.success(this.isEdit ? 'Question updated' : 'Question added');
      this.dialogRef.close(true);
    } catch (e) {
      this.serverError.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}
