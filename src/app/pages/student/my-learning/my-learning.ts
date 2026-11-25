import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { MyLearningService } from '../../../shared/common-services/my-learning.service';

/** Student "My Learning": the courses mapped to the student's batch, with progress and a Start / Continue button. */
@Component({
  selector: 'app-my-learning',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './my-learning.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', '../student.scss', './my-learning.scss'],
})
export class MyLearning implements OnInit {
  private readonly store = inject(MyLearningService);

  readonly courses = this.store.courses;
  readonly loaded = this.store.loaded;
  readonly error = signal<string | null>(null);

  readonly summary = computed(() => {
    const list = this.courses();
    return {
      total: list.length,
      done: list.filter(c => c.status === 'Completed').length,
      avg: list.length ? Math.round(list.reduce((a, c) => a + c.progress, 0) / list.length) : 0,
    };
  });

  ngOnInit(): void {
    this.store.load().catch(e => this.error.set(apiErrorMessage(e)));
  }

  action(status: string): string {
    return status === 'Completed' ? 'Review' : status === 'In progress' ? 'Continue' : 'Start';
  }

  pill(status: string): string {
    return status === 'Completed' ? 'g' : status === 'In progress' ? 'b' : '';
  }
}
