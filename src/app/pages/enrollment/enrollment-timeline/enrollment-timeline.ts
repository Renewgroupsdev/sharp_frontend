import { Component, input } from '@angular/core';
import { EnrollmentEvent } from '../../../shared/models/batch-enrollment.model';

/** A course being added to / removed from a batch, newest first. `showCourse` adds the course and batch to each line. */
@Component({
  selector: 'app-enrollment-timeline',
  standalone: true,
  template: `
    <ol class="tl">
      @for (e of events(); track e.id) {
        <li [class.removed]="e.event === 'Removed'">
          <span class="tl-dot"><i class="bi" [class]="e.event === 'Enrolled' ? 'bi-plus-lg' : 'bi-dash-lg'"></i></span>
          <div>
            <b>
              @if (showCourse()) { {{ e.course }} {{ e.event === 'Enrolled' ? 'added to' : 'removed from' }} {{ e.batch }} }
              @else { {{ e.event === 'Enrolled' ? 'Course added to the batch' : 'Course removed from the batch' }} }
            </b>
            <small>{{ e.actor }} · {{ e.source }} · {{ e.at }}</small>
          </div>
        </li>
      } @empty {
        <li class="tl-empty">No history yet.</li>
      }
    </ol>
  `,
  styles: [`
    .tl { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
    li { position: relative; display: flex; gap: 12px; padding: 0 0 14px 0; }
    li:not(:last-child)::before { content: ''; position: absolute; left: 13px; top: 28px; bottom: 0; width: 2px; background: var(--border-soft); }
    .tl-dot { flex: none; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: var(--status-green-bg); color: var(--status-green-text); font-size: 13px; }
    .removed .tl-dot { background: var(--status-red-bg); color: var(--status-red-text); }
    b { display: block; font-size: 13px; color: var(--text-dark); font-weight: 600; }
    small { color: var(--text-muted); font-size: 11.5px; }
    .tl-empty { color: var(--text-muted); font-size: 12.5px; padding: 8px 0; }
  `],
})
export class EnrollmentTimeline {
  readonly events = input.required<EnrollmentEvent[]>();
  readonly showCourse = input(true);
}
