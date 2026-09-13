import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FeedbackFormComponent } from '../../feedback-form/feedback-form.component';
import { FeedbackService } from '../../../services/feedback.service';

@Component({
  selector: 'app-user-settings-feedback-section',
  standalone: true,
  imports: [FeedbackFormComponent],
  templateUrl: './user-settings-feedback-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class UserSettingsFeedbackSectionComponent implements OnInit {
  showFeedbackForm = false;

  constructor(
    private feedbackService: FeedbackService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    void this.feedbackService.isConfigured().then((configured) => {
      this.showFeedbackForm = configured;
      this.cdr.markForCheck();
    });
  }
}
