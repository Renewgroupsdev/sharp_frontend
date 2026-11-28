import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { GalleryApi, GalleryInput, GalleryItem } from '../../shared/common-services/gallery-api.service';
import { ToastService } from '../../shared/common-services/toast.service';
import { CanActionDirective } from '../../shared/directives/can-action.directive';

const blank = (): GalleryInput => ({ title: '', description: '', event: '', event_date: '' });

/** Gallery: event photos and videos. Everyone browses; roles with Create / Edit / Delete on the module manage them. */
@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [FormsModule, CanActionDirective],
  templateUrl: './gallery.html',
  styleUrls: ['../../shared/styles/erp-page.scss', './gallery.scss'],
})
export class Gallery implements OnInit {
  private readonly api = inject(GalleryApi);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<GalleryItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly type = signal('');
  protected readonly event = signal('');

  protected readonly events = computed(() => [...new Set(this.items().map(i => i.event).filter((e): e is string => !!e))].sort());
  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.items().filter(i => (!this.type() || i.type === this.type()) && (!this.event() || i.event === this.event())
      && (!q || [i.title, i.description, i.event].some(x => (x ?? '').toLowerCase().includes(q))));
  });

  /** The open picture / video, and the add-or-edit form. */
  protected readonly viewing = signal<GalleryItem | null>(null);
  protected readonly form = signal<{ id: number | null } | null>(null);
  protected model: GalleryInput = blank();
  protected files: File[] = [];
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  async ngOnInit(): Promise<void> { await this.load(); }

  private async load(): Promise<void> {
    try {
      this.items.set(await this.api.list());
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected openAdd(): void { this.model = blank(); this.files = []; this.formError.set(null); this.form.set({ id: null }); }

  protected openEdit(i: GalleryItem): void {
    this.model = { title: i.title, description: i.description ?? '', event: i.event ?? '', event_date: i.event_date ?? '' };
    this.formError.set(null);
    this.form.set({ id: i.id });
  }

  protected onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.files = Array.from(input.files ?? []);
  }

  protected async save(): Promise<void> {
    const f = this.form();
    if (!f || this.saving()) return;
    if (!this.model.title.trim()) return void this.formError.set('Enter a title.');
    if (f.id === null && !this.files.length) return void this.formError.set('Choose at least one photo or video.');
    this.saving.set(true);
    this.formError.set(null);
    try {
      const input = { ...this.model, title: this.model.title.trim() };
      if (f.id === null) {
        await this.api.add(input, this.files);
        this.toast.success('Added to the gallery');
      } else {
        await this.api.update(f.id, input);
        this.toast.success('Gallery item updated');
      }
      this.form.set(null);
      await this.load();
    } catch (e) {
      this.formError.set(apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(i: GalleryItem): Promise<void> {
    if (!confirm(`Remove "${i.title}" from the gallery?`)) return;
    try {
      await this.api.remove(i.id);
      this.items.update(list => list.filter(x => x.id !== i.id));
      if (this.viewing()?.id === i.id) this.viewing.set(null);
      this.toast.success('Removed');
    } catch (e) {
      this.toast.error('Could not remove', apiErrorMessage(e));
    }
  }

  protected day(iso: string | null): string {
    return iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  }

  protected size(n: number): string { return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
}
