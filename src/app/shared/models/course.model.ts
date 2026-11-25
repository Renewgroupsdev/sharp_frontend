export const COURSE_MODES = ['On Campus', 'Off Campus', 'Industrial Visit', 'Field Trekking'] as const;
export const COURSE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
export const COURSE_STATUSES = ['Draft', 'Published', 'Archived'] as const;
export const COURSE_SCOPES = ['Public', 'Private'] as const;
export const LESSON_PRIVACY = ['Public', 'Enrolled students only', 'Private'] as const;

/** Where a lesson's content comes from. The stored value is the key; the form and lists show the label. */
export const LESSON_HOSTS = ['YouTube', 'Video upload', 'Document upload', 'Image upload', 'Editor', 'Google Drive'] as const;
export const HOST_LABEL: Record<string, string> = { YouTube: 'YouTube upload', 'Google Drive': 'Google Drive upload' };
export const hostLabel = (host: string): string => HOST_LABEL[host] ?? host;
export const HOST_URL: string[] = ['YouTube', 'Google Drive'];
export const HOST_FILE: Record<string, string> = {
  'Video upload': 'video/*,.mp4,.webm,.mov',
  'Document upload': '.doc,.docx,.txt,.ppt,.pptx,.pdf',
  'Image upload': 'image/*',
};
export const HOST_ICON: Record<string, string> = {
  YouTube: 'bi-youtube', 'Video upload': 'bi-camera-video', 'Document upload': 'bi-file-earmark-text', 'Image upload': 'bi-image',
  Editor: 'bi-pencil-square', 'Google Drive': 'bi-google',
};

/** The input a lesson form shows for each source: a link, the rich-text editor or a file upload. */
export interface HostField {
  kind: 'url' | 'editor' | 'file';
  label: string;
  placeholder?: string;
  hint: string;
}
export const HOST_FIELD: Record<string, HostField> = {
  YouTube: { kind: 'url', label: 'YouTube link', placeholder: 'https://www.youtube.com/watch?v=...', hint: 'Paste the video link from YouTube (youtube.com or youtu.be).' },
  'Google Drive': { kind: 'url', label: 'Google Drive share link', placeholder: 'https://drive.google.com/file/d/...', hint: 'Share the file with "Anyone with the link" first.' },
  Editor: { kind: 'editor', label: 'Lesson content', hint: 'Write or paste the lesson text.' },
  'Video upload': { kind: 'file', label: 'Upload video', hint: 'MP4, WebM or MOV video.' },
  'Document upload': { kind: 'file', label: 'Upload document', hint: 'DOC, DOCX, TXT, PPT, PPTX or PDF.' },
  'Image upload': { kind: 'file', label: 'Upload image', hint: 'JPG, PNG or GIF.' },
};

export interface Lesson {
  id: string;
  name: string;
  dur: number;
  host: string;
  privacy: string;
  desc: string;
  url?: string;
  content?: string;
  file?: { name: string; size: string };
}

export interface Chapter {
  id: string;
  name: string;
  desc?: string;
  /** Draft modules are hidden from learners. */
  status?: 'Draft' | 'Published';
  lessons: Lesson[];
}

export interface Course {
  id: string;
  /** Display code from the API, e.g. CRS-007. */
  code?: string;
  categoryId?: number;
  title: string;
  category: string;
  hours: number;
  /** Comma separated mentor names, or "Unassigned". */
  trainer: string;
  /** Server ids and names of the batches the course runs for. */
  batchIds: number[];
  batches: string[];
  status: string;
  desc: string;
  outcomes: string;
  reqs: string;
  mode: string;
  level: string;
  scope: string;
  thumb: string;
  deleted: boolean;
  deletedOn?: string;
  chapters: Chapter[];
}

export interface CourseCategory {
  id: string;
  n: string;
  desc: string;
  st: 'Active' | 'Inactive';
}

/** Mentor / admin feedback on a student's course (overall, or about one lesson). */
export interface CourseFeedback {
  id: string;
  cid: string;
  sid: string;
  /** Lesson id; empty for overall course feedback. */
  topic: string;
  text: string;
  by: string;
  on: string;
}

export interface EnrollmentRecord {
  id: string;
  sid: string;
  name: string;
  course: string;
  batch: string;
  on: string;
  status: 'Enrolled' | 'Completed' | 'Dropped' | string;
  /** Learning completion (0-100) shown in a course's student list. */
  progress?: number;
}

export const lessonsOf = (c: Course): (Lesson & { ch: string })[] => c.chapters.flatMap(ch => ch.lessons.map(l => ({ ...l, ch: ch.name })));

export const listify = (text: string | undefined): string[] => String(text ?? '').split(/\r?\n|;/).map(x => x.trim()).filter(Boolean);

export const mentorsOf = (c: Course): string[] => String(c.trainer ?? '').split(', ').filter(x => x && x !== 'Unassigned');

/** "24 Oct 2026" - the date style the prototype stores on records. */
export const today = (): string => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
