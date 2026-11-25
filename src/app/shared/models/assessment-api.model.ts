import {
  AnswerSheetMode, AssessType, Assessment, AssessmentInput, AttachmentInfo, Question, QuestionData, QuestionGroup, QuestionType, QuizResult, QuizSetup, defaultSetup,
  usesQuestions,
} from './assessment.model';

/** Resources and bodies of the sharp-api quiz / assignment / assessment endpoints (snake_case, lower-case enums). */

export interface ApiQuestionGroup { id: number; title: string; type: string; question_count?: number; quiz_count?: number }

export interface ApiQuestion {
  id: number;
  group_id: number;
  type: string;
  marks: number;
  text: string;
  image: string | null;
  data: QuestionData | [];
  explanation: string | null;
}

export interface ApiSetup {
  per_question: number;
  question_count?: number | null;
  min_percent?: number | null;
  review: boolean;
  random: boolean;
  multi: boolean;
  same_page: boolean;
  explanations: boolean;
  answer_sheets: boolean;
  score_report: boolean;
  total_correct: boolean;
  answer_sheet: AnswerSheetMode;
}

export interface ApiAssessment {
  id: number;
  type: string;
  title: string;
  course: string;
  module: string | null;
  topic: string | null;
  status: string;
  due_date: string | null;
  max_marks: number;
  min_percent: number;
  pass_marks: number;
  attempts: number;
  description: string | null;
  attachment: AttachmentInfo | null;
  setup: ApiSetup | null;
  group_ids?: number[];
}

export interface ApiQuizResult {
  id: number;
  assessment_id: number;
  quiz: string;
  course: string;
  min_percent: number;
  student_public_id: string;
  student_name: string;
  marks: number;
  total: number;
  result_percent: number;
  attempts: number;
}

export interface AssessmentPayload {
  type: string;
  title: string;
  course: string;
  module: string;
  topic: string;
  status: string;
  due_date?: string;
  max_marks?: number;
  min_percent?: number;
  description?: string;
  group_ids?: number[];
}

export interface SetupPayload extends ApiSetup { group_ids?: number[] }

export interface QuestionPayload {
  group_id: number;
  type: string;
  marks: number;
  text: string;
  image?: string | null;
  data: QuestionData;
  explanation: string;
}

const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const typeToApi = (t: AssessType): string => t.toLowerCase();
export const typeFromApi = (t: string): AssessType => cap(t) as AssessType;
export const questionTypeToApi = (t: QuestionType): string => t.toLowerCase().replace(/ /g, '_');
export const questionTypeFromApi = (t: string): QuestionType => cap(t.replace(/_/g, ' ')) as QuestionType;

const displayDate = (iso: string): string => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const toQuestionGroup = (g: ApiQuestionGroup): QuestionGroup => ({ id: String(g.id), title: g.title, type: typeFromApi(g.type) });

export const toQuestion = (q: ApiQuestion): Question => ({
  id: String(q.id),
  gid: String(q.group_id),
  type: questionTypeFromApi(q.type),
  marks: q.marks,
  q: q.text,
  image: q.image ?? '',
  data: Array.isArray(q.data) ? {} : q.data,
  expl: q.explanation ?? '',
});

function toSetup(s: ApiSetup, a: ApiAssessment): QuizSetup {
  return {
    perQ: s.per_question, review: s.review, random: s.random, multi: s.multi, count: s.question_count ?? 0, samePage: s.same_page,
    expl: s.explanations, sheets: s.answer_sheets, score: s.score_report, total: s.total_correct, answerSheet: s.answer_sheet,
    groups: (a.group_ids ?? []).map(String), minp: s.min_percent ?? a.min_percent,
  };
}

export function toAssessment(a: ApiAssessment): Assessment {
  const type = typeFromApi(a.type);
  const quiz = usesQuestions(type);
  return {
    id: String(a.id),
    type,
    title: a.title,
    course: a.course,
    module: a.module ?? '',
    topic: a.topic ?? 'All topics',
    due: quiz || !a.due_date ? '—' : displayDate(a.due_date),
    dueIso: quiz ? '' : a.due_date ?? '',
    max: a.max_marks,
    minp: a.min_percent,
    pass: a.pass_marks,
    attempts: a.attempts,
    status: cap(a.status),
    desc: a.description ?? '',
    attach: a.attachment,
    setup: a.setup ? toSetup(a.setup, a) : quiz ? { ...defaultSetup(), minp: a.min_percent, groups: (a.group_ids ?? []).map(String) } : null,
  };
}

export const toQuizResult = (r: ApiQuizResult): QuizResult => ({
  id: String(r.id),
  sid: r.student_public_id,
  name: r.student_name,
  course: r.course,
  quizId: String(r.assessment_id),
  quiz: r.quiz,
  minp: r.min_percent,
  total: r.total,
  marks: r.marks,
  result: r.result_percent,
  attempts: r.attempts,
});

export function toAssessmentPayload(i: AssessmentInput): AssessmentPayload {
  const base: AssessmentPayload = {
    type: typeToApi(i.type), title: i.title, course: i.course, module: i.module, topic: i.topic, status: i.status.toLowerCase(),
  };
  if (usesQuestions(i.type)) return { ...base, group_ids: i.groups.map(Number) };
  return { ...base, due_date: i.dueIso, max_marks: i.max, min_percent: i.minp, description: i.desc };
}

export function toSetupPayload(s: QuizSetup, quiz: boolean): SetupPayload {
  return {
    per_question: s.perQ, question_count: s.count, review: s.review, random: s.random, multi: s.multi, same_page: s.samePage,
    explanations: s.expl, answer_sheets: s.sheets, score_report: s.score, total_correct: s.total, answer_sheet: s.answerSheet,
    ...(quiz ? { min_percent: s.minp, group_ids: s.groups.map(Number) } : {}),
  };
}

export const toQuestionPayload = (groupId: number, i: { type: QuestionType; marks: number; q: string; image: string | null; data: QuestionData; expl: string }): QuestionPayload => ({
  group_id: groupId, type: questionTypeToApi(i.type), marks: i.marks, text: i.q, image: i.image || undefined, data: i.data, explanation: i.expl,
});
