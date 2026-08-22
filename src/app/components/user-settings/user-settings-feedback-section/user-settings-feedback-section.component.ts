import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { GitHubFeedbackFormComponent } from '../../github-feedback-form/github-feedback-form.component';
import type { UserSettingsFacade } from '../../../lib/user-settings-facade';

@Component({
  selector: 'app-user-settings-feedback-section',
  standalone: true,
  imports: [GitHubFeedbackFormComponent],
  templateUrl: './user-settings-feedback-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class UserSettingsFeedbackSectionComponent {
  @Input({ required: true }) host!: UserSettingsFacade;
}
