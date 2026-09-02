import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GitHubFeedbackFormComponent } from '../../github-feedback-form/github-feedback-form.component';

@Component({
  selector: 'app-user-settings-feedback-section',
  standalone: true,
  imports: [GitHubFeedbackFormComponent],
  templateUrl: './user-settings-feedback-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class UserSettingsFeedbackSectionComponent {}
