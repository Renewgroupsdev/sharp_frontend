import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ActivityLogService } from '../../../shared/common-services/activity-log.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { RichTextEditor } from '../../../shared/components/rich-text-editor/rich-text-editor';
import { HOST_FIELD, HOST_FILE, HOST_ICON, HOST_URL, LESSON_HOSTS, LESSON_PRIVACY, Lesson, hostLabel } from '../../../shared/models/course.model';

interface LessonDraft { name: string; dur: number; host: string; url: string; content: string; privacy: string; desc: string; }

/** Add / edit one lesson (topic) inside a chapter. */
@Component({
  selector: 'app-lesson-form',
  standalone: true,
  imports: [FormsModule, MatDialogModule, RichTextEditor],
  templateUrl: './lesson-form.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
})
export class LessonForm {
  private readonly dialogRef = inject(MatDialogRef<LessonForm, boolean>);
  private readonly data = inject<{ courseId: string; chapterId: string; lessonId?: string }>(MAT_DIALOG_DATA);
  private readonly store = inject(CoursesService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);
  private readonly http = inject(HttpClient);
  readonly uploading = signal(false);

  readonly course = this.store.get(this.data.courseId);
  readonly chapter = this.course?.chapters.find(c => c.id === this.data.chapterId);
  readonly existing = this.chapter?.lessons.find(l => l.id === this.data.lessonId);
  readonly isEdit = !!this.existing;

  readonly hosts = LESSON_HOSTS;
  readonly label = hostLabel;
  readonly privacyOptions = LESSON_PRIVACY;
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly host = signal(this.existing?.host ?? 'YouTube');
  readonly icon = HOST_ICON;
  readonly field = computed(() => HOST_FIELD[this.host()]);
  readonly needsUrl = computed(() => HOST_URL.includes(this.host()));
  readonly needsFile = computed(() => !!HOST_FILE[this.host()]);
  readonly accept = computed(() => HOST_FILE[this.host()] ?? '');
  private picked: File | null = null;

  model: LessonDraft = {
    name: this.existing?.name ?? '',
    dur: this.existing?.dur ?? 10,
    host: this.host(),
    url: this.existing?.url ?? '',
    content: this.existing?.content ?? '',
    privacy: this.existing?.privacy ?? 'Enrolled students only',
    desc: this.existing?.desc ?? '',
  };

  get currentFile(): string {
    const f = this.existing?.file;
    return f && this.existing?.host === this.host() ? `${f.name} (${f.size})` : '';
  }

  onHost(value: string): void { this.host.set(value); }

  onFile(event: Event): void {
    this.picked = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  close(): void { this.dialogRef.close(false); }

  async save(form: NgForm): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (!this.course || !this.chapter) return;
    const m = this.model, host = this.host(), name = m.name.trim(), url = m.url.trim();
    if (form.invalid || !name) return;
    const fail = (msg: string) => this.serverError.set(msg);
    if (HOST_URL.includes(host)) {
      if (!/^https?:\/\//i.test(url)) return fail('Enter a valid link starting with http:// or https://');
      if (host === 'YouTube' && !/youtu\.?be/i.test(url)) return fail('That does not look like a YouTube link');
    }
    if (host === 'Editor' && !m.content.trim()) return fail('Write the lesson content in the editor');
    if (HOST_FILE[host] && !this.picked && !(this.existing && this.existing.host === host && this.existing.file)) return fail(`Upload a file for ${hostLabel(host)}`);

    const lesson: Lesson = {
      id: this.existing?.id ?? `L${Date.now().toString(36)}`,
      name,
      dur: Number(m.dur) || 1,
      host,
      privacy: m.privacy,
      desc: m.desc.trim(),
      url: HOST_URL.includes(host) ? url : (HOST_FILE[host] ? this.existing?.url ?? '' : ''),
      content: host === 'Editor' ? m.content.trim() : '',
    };
    if (HOST_FILE[host]) {
      if (this.picked) {
        this.uploading.set(true);
        try {
          const body = new FormData();
          body.append('file', this.picked);
          const up = await firstValueFrom(this.http.post<{ url: string }>(`${environment.apiBaseUrl}/lesson-files`, body));
          lesson.url = up.url;
        } catch (e) {
          this.uploading.set(false);
          return fail(apiErrorMessage(e));
        }
        this.uploading.set(false);
        const kb = this.picked.size / 1024;
        lesson.file = { name: this.picked.name, size: kb < 1024 ? `${Math.round(kb)} KB` : `${(this.picked.size / 1048576).toFixed(1)} MB` };
      } else {
        lesson.file = this.existing?.file;
      }
    }

    const chapters = this.course.chapters.map(ch => (ch.id !== this.chapter!.id ? ch : {
      ...ch,
      lessons: this.existing ? ch.lessons.map(l => (l.id === lesson.id ? lesson : l)) : [...ch.lessons, lesson],
    }));
    this.store.setChapters(this.course.id, chapters);
    this.log.record('Course Management', `${this.existing ? 'Updated' : 'Added'} lesson “${name}” in ${this.course.title}`);
    this.toast.success(this.existing ? 'Lesson updated' : 'Lesson added');
    this.dialogRef.close(true);
  }
}
