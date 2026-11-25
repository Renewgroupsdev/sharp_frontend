export const ASSESS_TYPES = ['Quiz', 'Assignment', 'Assessment'] as const;
export type AssessType = (typeof ASSESS_TYPES)[number];
export const ASSESS_STATUSES = ['Draft', 'Published', 'Closed'] as const;

export const QUESTION_TYPES = ['Multiple choice', 'Sorting', 'Matching', 'Puzzle', 'Short answer', 'Long answer'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type AnswerSheetMode = 'correct' | 'wrong' | 'none';

export interface QuizSetup {
  perQ: number;
  review: boolean;
  random: boolean;
  /** Multiple attempts: on means unlimited retries, off means one attempt. */
  multi: boolean;
  /** With random order on: how many questions each student gets (0 = all). */
  count: number;
  samePage: boolean;
  expl: boolean;
  sheets: boolean;
  score: boolean;
  total: boolean;
  answerSheet: AnswerSheetMode;
  groups: string[];
  minp: number;
}

export const defaultSetup = (): QuizSetup => ({
  perQ: 1, review: true, random: false, multi: true, count: 0, samePage: false, expl: true,
  sheets: true, score: true, total: true, answerSheet: 'correct', groups: [], minp: 60,
});

/** The instructor's document on an assignment / assessment. The file itself is fetched through the API, never by path. */
export interface AttachmentInfo {
  name: string;
  size: string;
  mime?: string | null;
  /** False for an older record that kept a file name but no stored file. */
  available?: boolean;
}

export interface Assessment {
  id: string;
  type: AssessType;
  title: string;
  course: string;
  module: string;
  topic: string;
  /** Display date ("20 Sep 2026"); an em dash for quizzes. */
  due: string;
  dueIso: string;
  max: number;
  minp: number;
  pass: number;
  attempts: number;
  status: string;
  desc: string;
  attach: AttachmentInfo | null;
  setup: QuizSetup | null;
}

export interface QuestionGroup {
  id: string;
  title: string;
  /** Quizzes and assessments keep separate groups, and so separate question banks. */
  type: AssessType;
}

export interface QuestionData {
  opts?: string[];
  correct?: number[];
  items?: string[];
  pairs?: string[][];
  puzzle?: string;
  hint?: string;
  shortAns?: string;
  keywords?: string;
  rubric?: string;
  wordlimit?: number;
}

export interface Question {
  id: string;
  gid: string;
  type: QuestionType;
  marks: number;
  q: string;
  image: string;
  data: QuestionData;
  expl: string;
}

export interface QuizResult {
  id: string;
  sid: string;
  name: string;
  course: string;
  quizId: string;
  quiz: string;
  minp: number;
  total: number;
  marks: number;
  result: number;
  attempts: number;
}

/** Fields the create / edit dialog collects for a quiz, assignment or assessment. */
export interface AssessmentInput {
  type: AssessType;
  title: string;
  course: string;
  module: string;
  topic: string;
  status: string;
  dueIso: string;
  max: number;
  minp: number;
  desc: string;
  groups: string[];
}

/** Quizzes and assessments are answered question by question; assignments are handed in as a submission. */
export const usesQuestions = (type: AssessType): boolean => type === 'Quiz' || type === 'Assessment';
