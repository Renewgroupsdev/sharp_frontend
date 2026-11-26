import { Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import { DetailCardIconVariant, RibbonItem } from '../../models/common-components.model';

const PALETTE = ['#0369a1', '#0e7490', '#0284c7', '#0f766e', '#075985', '#155e75', '#1d4ed8'];
const VARIANT_COLORS: Record<DetailCardIconVariant, string> = {
  primary: '#0369a1', green: '#0f766e', orange: '#0e7490', blue: '#0284c7', purple: '#075985',
};
const POPUP_LIMIT = 8;
const POPUP_WIDTH = 260;

/**
 * Reusable ribbon of counts: a chain of arrow tabs, one per item. Optional extras:
 * hover popup (items with `hoverItems`) and click-to-select (items with `filter`, bind `(select)`; `activeKeys` highlights the applied ones).
 */
@Component({
  selector: 'app-count-ribbon',
  standalone: true,
  templateUrl: './count-ribbon.html',
  styleUrl: './count-ribbon.scss',
})
export class CountRibbon {
  @Input() set items(v: RibbonItem[]) { this.list.set(v ?? []); }
  @Input() activeKeys: (string | null)[] = [];
  @Input() ariaLabel = 'Counts';
  @Output() select = new EventEmitter<RibbonItem>();

  private readonly list = signal<RibbonItem[]>([]);
  protected readonly view = computed(() => this.list().map((it, i) => ({
    ...it,
    k: it.filter ? `${it.filter.key}=${it.filter.value}` : (it.key ?? it.label),
    clickable: !!it.filter && this.select.observed,
    c: it.color ?? (it.iconVariant ? VARIANT_COLORS[it.iconVariant] : PALETTE[i % PALETTE.length]),
  })));

  protected readonly pop = signal<{ item: RibbonItem; left: number; top: number } | null>(null);
  protected readonly popLimit = POPUP_LIMIT;

  protected show(ev: Event, item: RibbonItem): void {
    if (!item.hoverItems) return;
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.pop.set({ item, left: Math.max(8, Math.min(r.left, window.innerWidth - POPUP_WIDTH - 10)), top: r.bottom + 6 });
  }

  protected hide(): void { this.pop.set(null); }

  protected pick(it: RibbonItem): void {
    if (!it.filter || !this.select.observed) return;
    this.select.emit(it);
    this.hide();
  }
}
