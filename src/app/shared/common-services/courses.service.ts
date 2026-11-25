import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { LocalCollection } from '../../core/data/local-collection';
import { MODULES, SYLLABUS } from '../../core/data/programme-data';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { Chapter, Course, CourseCategory, CourseFeedback } from '../models/course.model';
import { CategoryApiResource, CategoryPayload, ChapterApiResource, ChapterPayload, CourseApiResource, CourseCategoriesApi, CoursePayload, CoursesApi } from './courses-api.service';
import { ToastService } from './toast.service';

const SEED_CATEGORIES = (): CourseCategory[] => [
  { id: 'CAT-01', n: 'Soft skills', desc: 'Communication, networking and workplace behaviour', st: 'Active' },
  { id: 'CAT-02', n: 'Technical', desc: 'Tools and technical know-how', st: 'Active' },
  { id: 'CAT-03', n: 'Career', desc: 'Resume, interview and placement readiness', st: 'Active' },
  { id: 'CAT-04', n: 'Compliance', desc: 'Policies, safety and regulations', st: 'Active' },
];

function seedCourses(): Course[] {
  const syllabus = SYLLABUS as unknown as Record<number, { topics: string[]; out: string }>;
  const hours = [6, 6, 6, 6, 3, 8];
  return MODULES.slice(0, 6).map((m, i) => {
    const sy = syllabus[i + 1] ?? { topics: [], out: '' };
    const chapters: Chapter[] = sy.topics.length
      ? [{
        id: `CH${i + 1}`,
        name: 'Core topics',
        lessons: sy.topics.map((t, j) => ({ id: `L${i + 1}${j}`, name: t, dur: 15 + 5 * (j % 3), host: 'Editor', content: '', privacy: 'Enrolled students only', desc: '' })),
      }]
      : [];
    return {
      id: `CRS-${String(i + 1).padStart(3, '0')}`,
      title: m.title,
      category: 'Soft skills',
      hours: hours[i],
      trainer: i % 2 ? 'R. Venkatesh' : 'Ms. Anitha Rajan',
      batchIds: [],
      batches: ['SHARP Batch 07'],
      status: 'Published',
      desc: `Part of the SHARP programme: ${m.title}.`,
      outcomes: sy.out || '',
      reqs: 'Enrolled SHARP student. Attend the scheduled sessions.',
      mode: 'On Campus',
      level: 'Beginner',
      scope: 'Private',
      thumb: '',
      deleted: false,
      chapters,
    };
  });
}

const isServerId = (id: string | undefined): id is string => !!id && /^\d+$/.test(id);
const serverId = (id: string | undefined): number | undefined => (isServerId(id) ? Number(id) : undefined);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function mapChapters(rows: ChapterApiResource[] = []): Chapter[] {
  return rows.map(ch => ({
    id: String(ch.id),
    name: ch.name,
    desc: ch.description ?? '',
    status: ch.status === 'Draft' ? 'Draft' : 'Published',
    lessons: ch.lessons.map(l => ({
      id: String(l.id),
      name: l.name,
      dur: l.duration_minutes,
      host: l.host,
      privacy: l.privacy,
      desc: l.description ?? '',
      url: l.url ?? '',
      content: l.content ?? '',
      file: l.file_name ? { name: l.file_name, size: l.file_size ?? '' } : undefined,
    })),
  }));
}

export function toCourse(r: CourseApiResource): Course {
  return {
    id: String(r.id),
    code: r.code,
    title: r.title,
    category: r.category ?? '',
    categoryId: r.category_id,
    hours: r.hours,
    trainer: r.mentors?.length ? r.mentors.join(', ') : 'Unassigned',
    batchIds: (r.batches ?? []).map(b => b.id),
    batches: (r.batches ?? []).map(b => b.name),
    status: r.status,
    desc: r.description ?? '',
    outcomes: r.outcomes ?? '',
    reqs: r.requirements ?? '',
    mode: r.mode,
    level: r.level,
    scope: r.scope,
    thumb: r.thumbnail ?? '',
    deleted: !!r.deleted_at,
    deletedOn: r.deleted_at ? shortDate(r.deleted_at) : undefined,
    chapters: mapChapters(r.chapters),
  };
}

const toCategory = (r: CategoryApiResource): CourseCategory => ({ id: String(r.id), n: r.name, desc: r.description ?? '', st: r.status });

function toChapterPayload(chapters: Chapter[]): ChapterPayload[] {
  return chapters.map(ch => ({
    id: serverId(ch.id),
    name: ch.name,
    description: ch.desc || null,
    status: ch.status ?? 'Published',
    lessons: ch.lessons.map(l => ({
      id: serverId(l.id),
      name: l.name,
      duration_minutes: Number(l.dur) || 1,
      host: l.host,
      url: l.url || null,
      content: l.content || null,
      privacy: l.privacy,
      description: l.desc || null,
      file_name: l.file?.name ?? null,
      file_size: l.file?.size ?? null,
    })),
  }));
}

/** The editable course fields the form submits. */
export type CourseInput = Pick<Course, 'title' | 'category' | 'hours' | 'trainer' | 'batchIds' | 'mode' | 'level' | 'scope' | 'status' | 'desc' | 'outcomes' | 'reqs' | 'thumb'>;
export type CategoryInput = { n: string; desc: string; st: string };

/**
 * Courses (with their chapters and lessons) plus the category list and per-student feedback, stored through the
 * Laravel courses API. The signal collections are a cache the screens read; every write goes to the API first.
 */
@Injectable({ providedIn: 'root' })
export class CoursesService extends LocalCollection<Course> {
  readonly categories = new LocalCollection<CourseCategory>('course-categories', SEED_CATEGORIES, 'CAT', 2);
  readonly feedback = new LocalCollection<CourseFeedback>('course-feedback', () => [], 'FB', 3);

  private readonly api = inject(CoursesApi);
  private readonly categoriesApi = inject(CourseCategoriesApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private loading?: Promise<void>;
  private chain: Promise<void> = Promise.resolve();
  private pendingCurriculum = 0;

  constructor() {
    super('courses', seedCourses, 'CRS', 3);
    // Pages that only read courses (pickers, learner views) still get live data once signed in.
    if (this.auth.accessToken()) this.loadFromApi().catch(() => undefined);
  }

  /** Courses that are not in the trash. */
  live(): Course[] { return this.items().filter(c => !c.deleted); }

  /** Titles of non-deleted courses, for pickers in other modules. */
  courseTitles(): string[] { return this.live().map(c => c.title); }

  byTitle(title: string): Course | undefined { return this.items().find(c => c.title === title); }

  categoryUse(name: string): number { return this.items().filter(c => c.category === name).length; }

  /** Loads categories, courses and (for staff) the trash from the API. Concurrent calls share one request. */
  loadFromApi(): Promise<void> {
    this.loading ??= (async () => {
      try {
        const [categories, live, trashed] = await Promise.all([
          this.categoriesApi.list(),
          this.api.list(),
          this.api.trashed().catch(() => [] as CourseApiResource[]), // learners may not list the trash
        ]);
        this.categories.replace(categories.map(toCategory));
        this.replace([...live, ...trashed].map(toCourse));
      } finally {
        this.loading = undefined;
      }
    })();
    return this.loading;
  }

  /** Creates (no `id`) or updates a course through the API; the curriculum is saved separately by `setChapters`. */
  async saveCourse(input: CourseInput, id?: string): Promise<Course> {
    const old = id ? this.get(id) : undefined;
    if (id && !old) throw new Error('Course not found. Please reload the list.');
    const category = this.categories.items().find(k => k.n === input.category);
    if (!category) throw new Error('Choose a valid category.');
    const payload: CoursePayload = {
      title: input.title,
      course_category_id: Number(category.id),
      batch_ids: input.batchIds,
      hours: Number(input.hours) || 1,
      mentors: input.trainer && input.trainer !== 'Unassigned' ? input.trainer.split(', ') : [],
      mode: input.mode,
      level: input.level,
      scope: input.scope,
      status: input.status,
      description: input.desc,
      outcomes: input.outcomes,
      requirements: input.reqs,
      thumbnail: input.thumb || null,
    };
    const saved = toCourse(old ? await this.api.update(old.id, payload) : await this.api.create(payload));
    if (old) this.update(old.id, saved); else this.add(saved);
    return saved;
  }

  async trashCourse(id: string): Promise<void> {
    await this.api.remove(id);
    this.update(id, { deleted: true, deletedOn: shortDate(new Date().toISOString()) });
  }

  async restoreCourse(id: string): Promise<void> {
    this.update(id, toCourse(await this.api.restore(id)));
  }

  async purgeCourse(id: string): Promise<void> {
    await this.api.purge(id);
    this.remove(id);
  }

  /**
   * Replaces a course's chapters. The screen updates immediately; the API calls run one after another, and the
   * server's ids replace the local ones once the last pending save finishes. A failure reloads the server state.
   */
  setChapters(id: string, chapters: Chapter[]): void {
    this.update(id, { chapters });
    this.pendingCurriculum++;
    this.chain = this.chain.then(() => this.persistChapters(id));
  }

  private async persistChapters(id: string): Promise<void> {
    try {
      const course = this.get(id);
      if (!course) return;
      const saved = await this.api.replaceChapters(id, toChapterPayload(course.chapters));
      if (this.pendingCurriculum === 1) this.update(id, { chapters: mapChapters(saved.chapters) });
    } catch (e) {
      this.toast.error('Could not save the curriculum', apiErrorMessage(e));
      await this.loadFromApi().catch(() => undefined);
    } finally {
      this.pendingCurriculum--;
    }
  }

  async saveCategory(input: CategoryInput, id?: string): Promise<CourseCategory> {
    const payload: CategoryPayload = { name: input.n, description: input.desc, status: input.st };
    const saved = toCategory(id ? await this.categoriesApi.update(id, payload) : await this.categoriesApi.create(payload));
    if (id) {
      const old = this.categories.get(id);
      if (old && old.n !== saved.n) this.replace(this.items().map(c => (c.category === old.n ? { ...c, category: saved.n } : c)));
      this.categories.update(id, saved);
    } else {
      this.categories.add(saved, false);
    }
    return saved;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.categoriesApi.remove(id);
    this.categories.remove(id);
  }
}
