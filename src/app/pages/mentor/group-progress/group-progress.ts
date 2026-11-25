import { Component, inject } from '@angular/core';
import { MODULES } from '../../../core/data/programme-data';
import { MentorGroupService } from '../../../shared/common-services/mentor-group.service';

@Component({
  selector: 'app-group-progress',
  standalone: true,
  templateUrl: './group-progress.html',
  styleUrls: ['../mentor.scss'],
})
export class GroupProgress {
  readonly group = inject(MentorGroupService);
  readonly modules = MODULES;
}
