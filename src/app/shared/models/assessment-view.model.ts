import { AttachmentInfo, Assessment, usesQuestions } from './assessment.model';
import { MyAssessment } from './my-assessment.model';

/** What the "view assessment" popup shows, whichever side (admin or student) opened it. */
export interface AssessmentViewData {
  /** Staff view only: record id, and whether the popup offers an Edit button. */
  id?: string;
  editable?: boolean;
  type: string;
  title: string;
  course: string;
  /** Module and topic, already joined for display. */
  where: string;
  due: string;
  marks: string;
  status?: string;
  description: string;
  attachment: AttachmentInfo | null;
  /** Fetches the attached document; the API decides whether the signed-in user may read it. */
  loadFile: () => Promise<Blob>;
}

const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);
const place = (module: string | null, topic: string | null): string =>
  [module || 'General', topic && topic !== 'All topics' ? topic : ''].filter(Boolean).join(' · ');

export const assessmentView = (a: Assessment, loadFile: () => Promise<Blob>): AssessmentViewData => ({
  type: a.type, title: a.title, course: a.course, where: place(a.module, a.topic),
  due: usesQuestions(a.type) ? '—' : a.due, marks: `${a.max} marks · minimum ${a.minp}%`,
  status: a.status, description: a.desc, attachment: a.attach, loadFile, id: a.id, editable: true,
});

export const myAssessmentView = (a: MyAssessment, loadFile: () => Promise<Blob>): AssessmentViewData => ({
  type: cap(a.type), title: a.title, course: a.course, where: place(a.module, a.topic),
  due: a.due_date ?? 'No deadline', marks: `${a.max_marks} marks · pass mark ${a.min_percent}%`,
  description: a.description ?? '', attachment: a.attachment, loadFile,
});
