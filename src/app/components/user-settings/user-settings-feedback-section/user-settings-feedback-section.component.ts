import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FeedbackFormComponent } from '../../github-feedback-form/github-feedback-form.component';

@Component({
  selector: 'app-user-settings-feedback-section',
  standalone: true,
  imports: [FeedbackFormComponent],
  templateUrl: './user-settings-feedback-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class UserSettingsFeedbackSectionComponent {}
