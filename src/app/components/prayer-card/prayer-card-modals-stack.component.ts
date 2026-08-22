import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { PersonalPrayerAnsweredStatusModalComponent } from '../personal-prayer-answered-status-modal/personal-prayer-answered-status-modal.component';
import type { PersonalPrayerAnsweredStatusMode } from '../personal-prayer-answered-status-modal/personal-prayer-answered-status-modal.component';
import { PrayerAddUpdateModalComponent } from '../prayer-add-update-modal/prayer-add-update-modal.component';
import type { PrayerAddUpdatePayload } from '../prayer-add-update-modal/prayer-add-update-modal.component';
import { PrayerDeleteRequestModalComponent } from '../prayer-delete-request-modal/prayer-delete-request-modal.component';
import type { PrayerDeleteRequestPayload } from '../prayer-delete-request-modal/prayer-delete-request-modal.component';
import { PrayerCardPrayForModalComponent } from './prayer-card-pray-for-modal.component';
import type { PrayerCardAddUpdateTourElementIds } from '../../lib/prayer-card-tour-ids';

@Component({
  selector: 'app-prayer-card-modals-stack',
  standalone: true,
  imports: [
    PrayerAddUpdateModalComponent,
    PrayerDeleteRequestModalComponent,
    ConfirmationDialogComponent,
    PersonalPrayerAnsweredStatusModalComponent,
    PrayerCardPrayForModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prayer-card-modals-stack.component.html',
})
export class PrayerCardModalsStackComponent {
  @Input() showAddUpdateForm = false;
  @Input({ required: true }) prayerId!: string;
  @Input() isPersonal = false;
  @Input() richTextEditorsEnabled = true;
  @Input() addUpdateTourElementIds: PrayerCardAddUpdateTourElementIds | null =
    null;
  @Input() showDeleteRequestForm = false;
  @Input() showUpdateDeleteRequestForm: string | null = null;
  @Input() showConfirmationDialog = false;
  @Input() showUpdateConfirmationDialog = false;
  @Input() updateConfirmationTitle = '';
  @Input() updateConfirmationMessage = '';
  @Input() personalAnsweredStatusModalMode: PersonalPrayerAnsweredStatusMode | null =
    null;
  @Input() showShareModal = false;
  @Input() showPrayForModal = false;
  @Input() usesPersonalCooldown = false;

  @Output() closeAddUpdate = new EventEmitter<void>();
  @Output() addUpdateSubmit = new EventEmitter<PrayerAddUpdatePayload>();
  @Output() closeDeleteRequest = new EventEmitter<void>();
  @Output() deleteRequestSubmit = new EventEmitter<PrayerDeleteRequestPayload>();
  @Output() confirmDelete = new EventEmitter<void>();
  @Output() cancelDelete = new EventEmitter<void>();
  @Output() confirmUpdateDelete = new EventEmitter<void>();
  @Output() cancelUpdateDelete = new EventEmitter<void>();
  @Output() closePersonalAnsweredStatus = new EventEmitter<void>();
  @Output() confirmPersonalAnswered = new EventEmitter<void>();
  @Output() confirmPersonalUnanswered = new EventEmitter<string | null>();
  @Output() confirmShare = new EventEmitter<void>();
  @Output() cancelShare = new EventEmitter<void>();
  @Output() confirmPrayFor = new EventEmitter<boolean>();
  @Output() cancelPrayFor = new EventEmitter<void>();
}
