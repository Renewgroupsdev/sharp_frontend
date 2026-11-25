import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ANNOUNCE, MENTOR, SCHEDULE } from '../../../core/data/programme-data';

@Component({
  selector: 'app-mentor-more',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mentor-more.html',
  styleUrls: ['../mentor.scss'],
})
export class MentorMore {
  readonly me = inject(AuthService).actor;
  readonly mentor = MENTOR;
  readonly announcements = ANNOUNCE;
  readonly schedule = SCHEDULE;

  readonly links = [
    { link: '/app/certificate-review', icon: 'bi-award', title: 'Certificate approval', sub: 'Approve certificates earned by your group' },
    { link: '/app/community', icon: 'bi-chat-dots', title: 'SHARP Community', sub: 'Common Floor, group discussions and personal messages' },
    { link: '/app/group-progress', icon: 'bi-bar-chart-line', title: 'Group progress', sub: 'Module and assessment status per member' },
  ];
}
