import { Injectable, computed, inject } from '@angular/core';
import { LocalCollection } from '../../core/data/local-collection';
import { MODULES, QUIZ } from '../../core/data/programme-data';
import { AssessType, Assessment, AssessmentInput, Question, QuestionData, QuestionGroup, QuestionType, QuizResult, QuizSetup, defaultSetup, usesQuestions } from '../models/assessment.model';
import { isoDate } from '../utils/format.util';
import { Course, lessonsOf } from '../models/course.model';
import { toAssessment, toAssessmentPayload, toQuestion, toQuestionGroup, toQuestionPayload, toQuizResult, toSetupPayload } from '../models/assessment-api.model';
import { ActivityLogService } from './activity-log.service';
import { AssessmentsApi } from './assessments-api.service';
import { CoursesService } from './courses.service';
import { ToastService } from './toast.service';
import { UsersService } from './users.service';

const MODULE_NAME = 'Quiz, Assignment & Assessments';

const courseTitleList = (): string[] => MODULES.slice(0, 6).map(m => m.title);
const isoOf = (s: string): string => { const t = Date.parse(s); return isNaN(t) ? '' : isoDate(new Date(t)); };
const hashN = (str: string): number => { let h = 0; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

const totalOf = (a: Assessment, questions: Question[]): number => {
  const groups = a.setup?.groups ?? [];
  return questions.filter(q => groups.includes(q.gid)).reduce((s, q) => s + Number(q.marks || 0), 0);
};

function buildGroups(): QuestionGroup[] {
  return [{ id: 'QG-01', title: 'Communication — basics', type: 'Quiz' }, { id: 'QG-02', title: 'Networking — first contact', type: 'Quiz' }];
}

function buildQuestions(): Question[] {
  const out: Question[] = [];
  let n = 1;
  ([1, 2] as const).forEach(m => (QUIZ[m] ?? []).forEach(x => out.push({
    id: `Q-${String(n++).padStart(3, '0')}`, gid: `QG-0${m}`, type: 'Multiple choice', marks: 1, q: x.q, image: '',
    data: { opts: x.o, correct: [x.a] }, expl: '',
  })));
  return out;
}

function buildAssessments(): Assessment[] {
  const titles = courseTitleList();
  const base = (id: string, type: Assessment['type'], title: string, course: string, max: number, pass: number, attempts: number, due: string, status: string): Assessment => ({
    id, type, title, course, module: 'Core topics', topic: 'All topics', due: type === 'Quiz' ? '—' : due, dueIso: type === 'Quiz' ? '' : isoOf(due),
    max, minp: max ? Math.round(pass / max * 100) : 60, pass, attempts, status, desc: '', attach: null, setup: null,
  });
  const list = [
    base('ASM-001', 'Quiz', 'Communication Skills — quiz 1', titles[0], 20, 12, 2, '20 Sep 2026', 'Published'),
    base('ASM-002', 'Assignment', 'One-minute update — recorded', titles[0], 25, 15, 1, '27 Sep 2026', 'Published'),
    base('ASM-003', 'Assessment', 'Module 1 final assessment', titles[0], 50, 30, 2, '04 Oct 2026', 'Published'),
    base('ASM-004', 'Assessment', 'Module 2 final assessment', titles[1], 50, 30, 2, '25 Oct 2026', 'Draft'),
    base('ASM-005', 'Quiz', 'Business networking — quiz', titles[1] ?? titles[0], 0, 0, 2, '—', 'Published'),
  ];
  list[0].setup = { ...defaultSetup(), groups: ['QG-01'] };
  list[4].setup = { ...defaultSetup(), groups: ['QG-02'] };
  const questions = buildQuestions();
  list.filter(a => a.type === 'Quiz').forEach(a => {
    a.setup = a.setup ?? defaultSetup();
    a.max = totalOf(a, questions);
    a.minp = a.setup.minp;
    a.pass = Math.round(a.max * a.minp / 100);
  });
  return list;
}

function buildResults(): QuizResult[] {
  const students = inject(UsersService).students().slice(0, 4);
  const questions = buildQuestions();
  const out: QuizResult[] = [];
  let n = 1;
  buildAssessments().filter(a => a.type === 'Quiz').forEach(a => students.forEach(s => {
    const h = hashN(s.id + a.id), res = 45 + h % 56, tot = totalOf(a, questions) || 10;
    out.push({ id: `QR-${String(n++).padStart(3, '0')}`, sid: s.id, name: s.n, course: a.course, quizId: a.id, quiz: a.title, minp: a.minp, total: tot, marks: Math.round(res * tot / 100), result: res, attempts: 1 + h % 2 });
  }));
  return out;
}

export interface QuestionInput {
  gid: string;
  /** Type of the group created on the fly: quiz or assessment. */
  groupType: AssessType;
  /** Title of a group to create on the fly (when `gid` is the "new group" marker). */
  newGroup: string;
  type: QuestionType;
  marks: number;
  q: string;
  image: string | null;
  data: QuestionData;
  expl: string;
}

export const NEW_GROUP = '__new';

/** Quizzes, assignments and assessments with the question groups, question bank and quiz results behind them. */
@Injectable({ providedIn: 'root' })
export class AssessmentsService extends LocalCollection<Assessment> {
  private readonly log = inject(ActivityLogService);
  private readonly courses = inject(CoursesService);
  private readonly api = inject(AssessmentsApi);
  private readonly toast = inject(ToastService);

  readonly groups = new LocalCollection<QuestionGroup>('question_groups', buildGroups, 'QG', 2);
  readonly questions = new LocalCollection<Question>('question_bank', buildQuestions, 'Q', 3);
  readonly results = new LocalCollection<QuizResult>('quiz_results', buildResults, 'QR', 3);

  readonly quizzes = computed(() => this.items().filter(a => a.type === 'Quiz'));
  /** The question groups of one type; quizzes and assessments never share them. */
  groupsOf(type: AssessType): QuestionGroup[] { return this.groups.items().filter(g => g.type === type); }

  /** The questions whose group belongs to this type. */
  questionsOf(type: AssessType): Question[] {
    const ids = new Set(this.groupsOf(type).map(g => g.id));
    return this.questions.items().filter(q => ids.has(q.gid));
  }

  /** Quizzes and assessments: everything built from question groups. */
  readonly questionBased = computed(() => this.items().filter(a => usesQuestions(a.type)));

  private loading?: Promise<void>;

  constructor() {
    super('assessments', buildAssessments, 'ASM', 3);
    void this.loadAll().catch(() => this.toast.error('Could not load quizzes and assessments from the server'));
  }

  /**
   * Loads groups, questions, assessments and quiz results from the API into the local stores. Each list loads on its own,
   * so a role that may not read one (e.g. the question bank) still gets the rest. Shared while a load is in flight.
   */
  loadAll(): Promise<void> {
    this.loading ??= (async () => {
      try {
        const [groups, questions, assessments, results] = await Promise.allSettled([
          this.api.getGroups(), this.api.getQuestions(), this.api.getAssessments(), this.api.getResults(),
        ]);
        if (groups.status === 'fulfilled') this.groups.replace(groups.value.groups.map(toQuestionGroup));
        if (questions.status === 'fulfilled') this.questions.replace(questions.value.questions.map(toQuestion));
        if (assessments.status === 'fulfilled') this.replace(assessments.value.assessments.map(toAssessment));
        if (results.status === 'fulfilled') this.results.replace(results.value.results.map(toQuizResult));
        if (assessments.status === 'rejected') throw assessments.reason;
      } finally {
        this.loading = undefined;
      }
    })();
    return this.loading;
  }

  /** Reloads the assessments only; the API re-totals quizzes whenever questions or groups change. */
  private async reloadAssessments(): Promise<void> {
    this.replace((await this.api.getAssessments()).assessments.map(toAssessment));
  }

  /** Titles of the live (not deleted) courses to pick from. */
  courseTitles(): string[] { return this.courses.live().map(c => c.title); }

  /** Keeps assessments and quiz results attached to a course that was renamed. */
  renameCourse(from: string, to: string): void {
    this.replace(this.items().map(a => (a.course === from ? { ...a, course: to } : a)));
    this.results.replace(this.results.items().map(r => (r.course === from ? { ...r, course: to } : r)));
    this.api.renameCourse(from, to).catch(() => this.toast.error('Could not rename the course on its quizzes and assessments'));
  }

  private courseByTitle(title: string): Course | undefined { return this.courses.live().find(c => c.title === title); }

  /** Chapter names of the course; a single "Core topics" module when it has none yet. */
  moduleOptions(course: string): string[] {
    const chapters = this.courseByTitle(course)?.chapters ?? [];
    return chapters.length ? chapters.map(ch => ch.name) : ['Core topics'];
  }

  topicOptions(course: string): string[] {
    const c = this.courseByTitle(course);
    return ['All topics', ...(c ? lessonsOf(c).map(l => l.name) : [])];
  }

  /** Total marks of a quiz: the sum of the questions in its chosen groups. */
  quizTotal(a: Assessment): number { return totalOf(a, this.questions.items()); }

  questionCount(gid: string): number { return this.questions.items().filter(q => q.gid === gid).length; }

  groupTitle(gid: string): string { return this.groups.get(gid)?.title ?? '—'; }

  /** Creates (no `id`) or updates a quiz, assignment or assessment through the API. */
  async save(input: AssessmentInput, id?: string): Promise<Assessment> {
    const body = toAssessmentPayload(input);
    const res = id ? await this.api.updateAssessment(id, body) : await this.api.createAssessment(body);
    const rec = toAssessment(res.assessment);
    if (id) this.update(id, rec); else this.add(rec, false);
    this.log.record(MODULE_NAME, `${id ? 'Updated' : 'Created'} ${input.type.toLowerCase()} “${rec.title}”`);
    return rec;
  }

  /** Attaches (or, with `null`, removes) the instructor's document and refreshes the record from the API's answer. */
  async setAttachment(id: string, file: File | null): Promise<Assessment> {
    const res = file ? await this.api.uploadAttachment(id, file) : await this.api.deleteAttachment(id);
    const rec = toAssessment(res.assessment);
    this.update(id, rec);
    this.log.record(MODULE_NAME, `${file ? 'Uploaded' : 'Removed'} the document of “${rec.title}”`);
    return rec;
  }

  async removeAssessment(id: string): Promise<void> {
    await this.api.deleteAssessment(id);
    this.remove(id);
    this.log.record(MODULE_NAME, `Deleted assessment ${id}`);
  }

  async saveSetup(id: string, patch: Partial<QuizSetup>): Promise<void> {
    const it = this.get(id);
    if (!it) throw new Error('Not found. Please reload the list.');
    const setup: QuizSetup = { ...defaultSetup(), ...(it.setup ?? {}), ...patch };
    const res = await this.api.saveSetup(id, toSetupPayload(setup, usesQuestions(it.type)));
    this.update(id, toAssessment(res.assessment));
    this.log.record(MODULE_NAME, `Updated setup for “${it.title}”`);
  }

  async saveGroup(title: string, type: AssessType, id?: string): Promise<QuestionGroup> {
    const res = id ? await this.api.updateGroup(id, title) : await this.api.createGroup(title, type.toLowerCase());
    const rec = toQuestionGroup(res.group);
    if (id) this.groups.update(id, rec); else this.groups.add(rec, false);
    this.log.record(MODULE_NAME, `${id ? 'Renamed' : 'Added'} question group “${title}”`);
    return rec;
  }

  /** The API refuses to delete a group that still holds questions. */
  async removeGroup(id: string): Promise<void> {
    await this.api.deleteGroup(id);
    this.groups.remove(id);
    await this.reloadAssessments();
    this.log.record(MODULE_NAME, `Deleted question group ${id}`);
  }

  async saveQuestion(input: QuestionInput, id?: string): Promise<Question> {
    const gid = input.gid === NEW_GROUP ? (await this.saveGroup(input.newGroup, input.groupType)).id : input.gid;
    const body = toQuestionPayload(Number(gid), { ...input, image: input.image });
    const res = id ? await this.api.updateQuestion(id, body) : await this.api.createQuestion(body);
    const rec = toQuestion(res.question);
    if (id) this.questions.update(id, rec); else this.questions.add(rec, false);
    await this.reloadAssessments();
    this.log.record(MODULE_NAME, `${id ? 'Updated' : 'Added'} ${input.type.toLowerCase()} question ${rec.id}`);
    return rec;
  }

  async removeQuestion(id: string): Promise<void> {
    await this.api.deleteQuestion(id);
    this.questions.remove(id);
    await this.reloadAssessments();
    this.log.record(MODULE_NAME, `Deleted question ${id}`);
  }
}
