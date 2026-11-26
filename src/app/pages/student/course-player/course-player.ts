import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { ModuleState, MyLearningApi, MyLearningService, ProgressSummary } from '../../../shared/common-services/my-learning.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { Course, HOST_ICON, Lesson, hostLabel } from '../../../shared/models/course.model';

type Viewer = { kind: 'embed'; url: SafeResourceUrl } | { kind: 'video'; url: string } | { kind: 'text'; html: string } | { kind: 'pdf'; url: SafeResourceUrl; name: string } | { kind: 'image'; url: string; name: string } | { kind: 'file'; name: string; size: string; url?: string };

const YOUTUBE_ID = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/;
const DRIVE_ID = /drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/;

/**
 * Student course player: modules and lessons on the right, the open lesson on the left, "Mark complete" saves progress.
 * A module is locked until the one before it is finished (lessons done and its quizzes passed) or a mentor opens it early.
 */
@Component({
  selector: 'app-course-player',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './course-player.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', '../student.scss', './course-player.scss'],
})
export class CoursePlayer implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(MyLearningApi);
  private readonly list = inject(MyLearningService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly icon = HOST_ICON;
  readonly hostLabel = hostLabel;
  readonly course = signal<Course | null>(null);
  readonly summary = signal<ProgressSummary | null>(null);
  readonly modules = signal<ModuleState[]>([]);
  readonly done = signal<ReadonlySet<string>>(new Set());
  readonly currentId = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  /** The lock state of each module, by chapter id. */
  readonly gate = computed(() => new Map(this.modules().map(m => [String(m.chapter_id), m])));

  /** Lessons in learning order, with the module each belongs to. */
  readonly lessons = computed(() => (this.course()?.chapters ?? []).flatMap(ch => ch.lessons.map(l => ({ ...l, module: ch.name, chapterId: ch.id }))));
  readonly current = computed(() => this.lessons().find(l => l.id === this.currentId()));
  readonly isDone = computed(() => this.done().has(this.currentId()));

  /** The lesson after the open one, unless it sits in a locked module or still waits for this lesson to be completed. */
  readonly next = computed(() => {
    const all = this.lessons(), i = all.findIndex(l => l.id === this.currentId());
    const n = i >= 0 ? all[i + 1] : undefined;
    return n && !this.locked(n.chapterId) && !this.lessonLocked(n.id, n.chapterId) ? n : undefined;
  });

  /** Set when finishing this lesson is not enough to reach the next one: the reason (a quiz to pass, say). */
  readonly blockedNext = computed(() => {
    const all = this.lessons(), i = all.findIndex(l => l.id === this.currentId());
    const n = i >= 0 ? all[i + 1] : undefined;
    return n && this.locked(n.chapterId) ? this.gate().get(n.chapterId)?.reason ?? 'The next module is locked.' : null;
  });

  readonly viewer = computed<Viewer | null>(() => {
    const l = this.current();
    return l ? this.viewerOf(l) : null;
  });

  async ngOnInit(): Promise<void> {
    try {
      this.apply(await this.api.detail(this.route.snapshot.paramMap.get('id') ?? ''));
      const open = this.lessons().filter(l => !this.locked(l.chapterId) && !this.lessonLocked(l.id, l.chapterId));
      this.select((open.find(l => !this.done().has(l.id)) ?? open[0] ?? this.lessons()[0])?.id ?? '');
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    }
  }

  private apply(d: { course: Course; progress: ProgressSummary; completed_lesson_ids: number[]; modules: ModuleState[] }): void {
    this.course.set(d.course);
    this.summary.set(d.progress);
    this.modules.set(d.modules);
    this.done.set(new Set(d.completed_lesson_ids.map(String)));
  }

  /** Re-reads the course: finishing a lesson (or a quiz elsewhere) can open the next module. */
  private async refresh(): Promise<void> {
    const c = this.course();
    if (c) this.apply(await this.api.detail(c.id));
  }

  locked(chapterId: string): boolean { return this.gate().get(chapterId)?.locked ?? false; }

  state(chapterId: string): ModuleState | undefined { return this.gate().get(chapterId); }

  /** A lesson waits until the lesson before it in its module is completed. */
  lessonLocked(lessonId: string, chapterId: string): boolean {
    return this.gate().get(chapterId)?.lessons?.find(x => String(x.id) === lessonId)?.locked ?? false;
  }

  lessonReason(lessonId: string, chapterId: string): string | null {
    return this.gate().get(chapterId)?.lessons?.find(x => String(x.id) === lessonId)?.reason ?? null;
  }

  select(id: string): void {
    const lesson = this.lessons().find(l => l.id === id);
    if (lesson && this.locked(lesson.chapterId)) {
      return void this.toast.error('This module is locked', this.gate().get(lesson.chapterId)?.reason ?? undefined);
    }
    if (lesson && this.lessonLocked(lesson.id, lesson.chapterId)) {
      return void this.toast.warning('Finish the previous lesson first', this.lessonReason(lesson.id, lesson.chapterId) ?? undefined);
    }
    this.currentId.set(id);
    if (id) this.api.open(id).then(s => this.applyProgress(s.progress)).catch(() => undefined);
  }

  async complete(): Promise<void> {
    const id = this.currentId();
    if (!id || this.saving()) return;
    this.saving.set(true);
    try {
      const state = await this.api.complete(id);
      this.done.set(new Set(state.completed_lesson_ids.map(String)));
      this.applyProgress(state.progress);
      await this.refresh();
      if (state.progress.status === 'Completed') this.toast.success('Course completed', 'You have finished every lesson.');
      else if (this.next()) this.select(this.next()!.id);
      else if (this.blockedNext()) this.toast.success('Lesson complete', this.blockedNext() ?? undefined);
    } catch (e) {
      this.toast.error('Could not save your progress', apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  private applyProgress(progress: ProgressSummary): void {
    this.summary.set(progress);
    const c = this.course();
    if (c) this.list.applyProgress(Number(c.id), progress);
  }

  /** Only embed URLs built here (YouTube / Drive ids) reach an iframe, never the raw link. */
  private viewerOf(l: Lesson): Viewer {
    const url = l.url ?? '';
    const trust = (u: string) => this.sanitizer.bypassSecurityTrustResourceUrl(u);
    switch (l.host) {
      case 'YouTube': {
        const id = YOUTUBE_ID.exec(url)?.[1];
        return id ? { kind: 'embed', url: trust(`https://www.youtube-nocookie.com/embed/${id}?rel=0`) } : { kind: 'text', html: '<p>This YouTube link could not be read.</p>' };
      }
      case 'Google Drive': {
        const id = DRIVE_ID.exec(url)?.[1];
        return id ? { kind: 'embed', url: trust(`https://drive.google.com/file/d/${id}/preview`) } : { kind: 'text', html: '<p>This Google Drive link could not be read.</p>' };
      }
      case 'Video upload': return url ? { kind: 'video', url } : { kind: 'file', name: l.file?.name ?? l.name, size: l.file?.size ?? '' };
      case 'Editor': return { kind: 'text', html: l.content ?? '' };
      case 'Image upload': return url ? { kind: 'image', url, name: l.file?.name ?? l.name } : { kind: 'file', name: l.file?.name ?? l.name, size: l.file?.size ?? '' };
      default:
        if (url && /\.pdf(\?|$)/i.test(url)) return { kind: 'pdf', url: trust(url), name: l.file?.name ?? l.name };
        return { kind: 'file', name: l.file?.name ?? l.name, size: l.file?.size ?? '', url: url || undefined };
    }
  }
}
