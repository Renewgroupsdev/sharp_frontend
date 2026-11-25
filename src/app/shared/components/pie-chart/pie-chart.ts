import { Component, computed, input } from '@angular/core';

export interface PieSlice {
  label: string;
  value: number;
  /** A CSS colour. Leave it out to take the next colour of the palette, in a fixed order. */
  color?: string;
  /** Small grey text under the label in the legend. */
  note?: string;
}

const CX = 80, CY = 80, R = 76;
const point = (angle: number): string => `${(CX + R * Math.sin(angle)).toFixed(2)} ${(CY - R * Math.cos(angle)).toFixed(2)}`;

/**
 * A small reusable pie chart with its legend. Wedges run clockwise from the top in the order given, one per slice that has a
 * value, and a slice that is all of the pie is a full disc. Colours come from the categorical palette in a fixed order (with a
 * dark-theme set); every wedge is also named in the legend with its count and share, so colour is never the only cue.
 */
@Component({
  selector: 'app-pie-chart',
  standalone: true,
  templateUrl: './pie-chart.html',
  styleUrl: './pie-chart.scss',
})
export class PieChart {
  readonly slices = input.required<PieSlice[]>();
  /** Words for the total under the pie, e.g. "submissions". */
  readonly unit = input('items');
  readonly emptyText = input('Nothing yet');

  protected readonly total = computed(() => this.slices().reduce((n, s) => n + s.value, 0));

  protected readonly rows = computed(() => this.slices().map((s, i) => ({
    ...s,
    color: s.color ?? `var(--pc${(i % 4) + 1})`,
    percent: this.total() ? Math.round((s.value / this.total()) * 100) : 0,
  })));

  protected readonly wedges = computed(() => {
    const all = this.total();
    let start = 0;
    return this.rows().filter(r => r.value > 0).map(r => {
      const sweep = (r.value / all) * 2 * Math.PI;
      const path = `M ${CX} ${CY} L ${point(start)} A ${R} ${R} 0 ${sweep > Math.PI ? 1 : 0} 1 ${point(start + sweep)} Z`;
      start += sweep;
      return { ...r, full: r.value === all, path };
    });
  });

  protected readonly summary = computed(() => this.rows().map(r => `${r.value} ${r.label.toLowerCase()}`).join(', '));
}
