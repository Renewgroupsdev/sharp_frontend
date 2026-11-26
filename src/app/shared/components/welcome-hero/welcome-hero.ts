import { Component, computed, inject, input } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';

/** LMS-style greeting banner shown at the top of the dashboards: name, role and a study-to-placement journey strip. */
@Component({
  selector: 'app-welcome-hero',
  standalone: true,
  templateUrl: './welcome-hero.html',
  styleUrl: './welcome-hero.scss',
})
export class WelcomeHero {
  private readonly auth = inject(AuthService);

  /** Optional line under the greeting; falls back to a role-based message. */
  readonly subtitle = input<string>('');

  protected readonly name = computed(() => this.auth.actor()?.n ?? '');
  protected readonly role = computed(() => this.auth.role() ?? '');

  protected readonly greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  protected readonly today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  protected readonly message = computed(() => {
    if (this.subtitle()) return this.subtitle();
    return this.role() === 'Mentor'
      ? 'Guide your learners through every module, review their work and move them closer to placement.'
      : 'Track courses, assessments, certificates and placement readiness across every batch in one place.';
  });

  protected readonly steps = [
    { icon: 'bi-journal-bookmark-fill', label: 'Learn' },
    { icon: 'bi-pencil-square', label: 'Practice' },
    { icon: 'bi-clipboard2-check-fill', label: 'Assess' },
    { icon: 'bi-patch-check-fill', label: 'Certify' },
    { icon: 'bi-briefcase-fill', label: 'Get placed' },
  ];
}
