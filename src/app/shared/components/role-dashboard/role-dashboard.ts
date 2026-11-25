import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { RoleDashboardService } from '../../common-services/role-dashboard.service';
import { BarsBlock, ListBlock, PieBlock, ProgressBlock, RoleDashboardData } from '../../models/role-dashboard.model';
import { PieChart } from '../pie-chart/pie-chart';

/**
 * The dashboard of whoever is signed in, drawn from the figures and blocks the API sends for their role: a row of totals, then
 * pies, bars, progress meters and lists. One component serves every role, so a new figure only needs a new block in the API.
 */
@Component({
  selector: 'app-role-dashboard',
  standalone: true,
  imports: [RouterLink, PieChart],
  templateUrl: './role-dashboard.html',
  styleUrl: './role-dashboard.scss',
})
export class RoleDashboard implements OnInit {
  private readonly api = inject(RoleDashboardService);

  /** Show the title and note above the figures. */
  readonly heading = input(true);

  protected readonly data = signal<RoleDashboardData | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);

  protected readonly maxOf = (b: BarsBlock): number => Math.max(1, ...b.items.map(i => i.value));
  protected readonly asPie = (b: unknown) => b as PieBlock;
  protected readonly asBars = (b: unknown) => b as BarsBlock;
  protected readonly asProgress = (b: unknown) => b as ProgressBlock;
  protected readonly asList = (b: unknown) => b as ListBlock;

  protected readonly hasContent = computed(() => !!this.data() && (this.data()!.kpis.length > 0 || this.data()!.blocks.length > 0));

  async ngOnInit(): Promise<void> {
    try {
      this.data.set(await this.api.load());
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
