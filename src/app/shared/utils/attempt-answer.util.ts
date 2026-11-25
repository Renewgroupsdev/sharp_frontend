import { AttemptQuestion } from '../models/quiz-attempt.model';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/**
 * Turns a stored answer (the student's, or the answer sheet) into lines a person can read, whatever the question type.
 * Multiple choice holds option positions, sorting an ordered list, matching pairs, and the rest plain text.
 */
export function answerLines(q: Pick<AttemptQuestion, 'type' | 'options'>, value: unknown): string[] {
  if (value === null || value === undefined || value === '') return [];

  switch (q.type) {
    case 'multiple_choice': {
      const picks = Array.isArray(value) ? value : [value];
      return picks.map(i => q.options?.[Number(i)] ?? text(i));
    }
    case 'sorting':
      return (Array.isArray(value) ? value : [value]).map((s, i) => `${i + 1}. ${text(s)}`);
    case 'matching': {
      if (isObject(value)) return Object.entries(value).map(([a, b]) => `${a} → ${text(b)}`);
      return (Array.isArray(value) ? value : []).map(p => (Array.isArray(p) ? `${text(p[0])} → ${text(p[1])}` : text(p)));
    }
    case 'short_answer': {
      if (isObject(value)) {
        const lines = [text(value['answer'])].filter(Boolean);
        if (value['keywords']) lines.push(`Keywords: ${text(value['keywords'])}`);
        return lines;
      }
      return [text(value)];
    }
    default:
      return [text(value)];
  }
}

/** How a question went, for the badge and colour: right, wrong, partly right, waiting for a mentor, or skipped. */
export type QuestionVerdict = 'correct' | 'wrong' | 'partial' | 'pending' | 'skipped';

export function verdict(q: Pick<AttemptQuestion, 'correct' | 'answered' | 'marks' | 'marks_awarded'>): QuestionVerdict {
  if (q.correct === null) return 'pending';
  if (q.correct) return 'correct';
  if (!q.answered) return 'skipped';
  return q.marks_awarded > 0 && q.marks_awarded < q.marks ? 'partial' : 'wrong';
}
