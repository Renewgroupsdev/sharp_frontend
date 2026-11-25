import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { comingSoonInfo } from './coming-soon.model';

/**
 * One reusable placeholder for every module that is not built yet. It has no inputs: the content comes from
 * the route's `data` (see `comingSoon()` in coming-soon.routes.ts), so adding a new placeholder page is a
 * config entry, not a new component.
 */
@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './coming-soon.html',
  styleUrl: './coming-soon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoon {
  protected readonly info = comingSoonInfo(inject(ActivatedRoute).snapshot.data);
  protected readonly homeUrl = inject(AuthService).homeUrl();
}
