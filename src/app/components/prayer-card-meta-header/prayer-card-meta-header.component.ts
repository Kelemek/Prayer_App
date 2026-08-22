import { Component, ChangeDetectionStrategy, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardMetaHeaderBandComponent } from '../card-meta-header-band/card-meta-header-band.component';
import { PersonalCategoryPillComponent } from '../personal-category-color-picker/personal-category-pill.component';
import { CardActionsOverflowMenuComponent } from '../card-actions-overflow-menu/card-actions-overflow-menu.component';
import type { CardActionsOverflowItem } from '../card-actions-overflow-menu/card-actions-overflow-menu.types';
import {
  getPrayerStatusHeaderTextClasses,
  getPrayerStatusLabel,
} from '../../lib/prayer-status-header';
import { formatPrayerCardShortDateParts } from '../../lib/prayer-update-header';
import {
  PRAYER_CARD_HEADER_BLEED_CLASSES,
  PRAYER_CARD_HEADER_BAND_ROUNDED_CLASSES,
  PRAYER_CARD_HEADER_INSET_CLASSES,
  getMetaHeaderBandLayoutClasses,
  type MetaHeaderBandSize,
} from '../../lib/prayer-card-layout';

@Component({
  selector: 'app-prayer-card-meta-header',
  standalone: true,
  imports: [CommonModule, CardMetaHeaderBandComponent, PersonalCategoryPillComponent, CardActionsOverflowMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card-meta-header-band
      [layout]="showCenterDateTime ? 'three-column' : 'two-column'"
      [bandSize]="bandSize"
      [bleedClasses]="bleedClasses"
      [roundedClasses]="roundedClasses"
      [actionsInsetClasses]="actionsInsetClasses"
      [centerDate]="showCenterDateTime ? metaHeaderDate : null"
      [centerTime]="showCenterDateTime ? metaHeaderTime : null"
      [centerDragHandle]="centerDragHandle"
      [centerDragHandleId]="centerDragHandleId"
      [compactActionsInset]="isPersonal"
    >
      <div cardMetaLeft class="w-full min-w-0">
        @if (isPersonal) {
          @if (category) {
          <app-personal-category-pill
            [category]="category"
          />
          }
        } @else if (showStatus) {
        <span
          [class]="'block min-w-0 max-w-full truncate font-bold ' + layoutClasses.textSmClasses + ' ' + headerInsetClasses + ' ' + statusTextClasses"
        >
          {{ statusLabel }}
        </span>
        }
      </div>
      <div cardMetaRight class="flex items-center justify-end">
        <app-card-actions-overflow-menu
          [items]="overflowItems"
          [bandSize]="bandSize"
        />
      </div>
    </app-card-meta-header-band>
  `,
})
export class PrayerCardMetaHeaderComponent {
  /** Override when the card shell uses non-standard horizontal padding (e.g. presentation p-8). */
  @Input() bleedClasses = PRAYER_CARD_HEADER_BLEED_CLASSES;
  @Input() roundedClasses = PRAYER_CARD_HEADER_BAND_ROUNDED_CLASSES;
  @Input() headerInsetClasses = PRAYER_CARD_HEADER_INSET_CLASSES;
  @Input() actionsInsetClasses: string | null = null;
  @Input() bandSize: MetaHeaderBandSize = 'sm';

  @Input({ required: true }) prayerCreatedAt!: string;
  @Input() isPersonal = false;
  @Input() category: string | null = null;
  @Input() status = 'current';
  @Input() showStatus = false;
  @Input() showCenterDateTime = true;
  @Input() showDelete = false;
  @Input() showReminder = false;
  @Input() hasReminder = false;
  @Input() reminderBellTourId: string | null = null;
  @Input() personalEditTourId: string | null = null;
  @Input() personalAnsweredTourId: string | null = null;
  @Input() personalDeleteTourId: string | null = null;
  @Input() centerDragHandle = false;
  @Input() centerDragHandleId: string | null = null;

  @Output() toggleAnswered = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() share = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() reminder = new EventEmitter<void>();
  @Output() pickerOpenChange = new EventEmitter<boolean>();

  get isAnswered(): boolean {
    return this.category === 'Answered';
  }

  get metaHeaderDate(): string {
    return formatPrayerCardShortDateParts(this.prayerCreatedAt).date;
  }

  get metaHeaderTime(): string {
    return formatPrayerCardShortDateParts(this.prayerCreatedAt).time;
  }

  get statusLabel(): string {
    return getPrayerStatusLabel(this.status);
  }

  get statusTextClasses(): string {
    return getPrayerStatusHeaderTextClasses(this.status);
  }

  get layoutClasses() {
    return getMetaHeaderBandLayoutClasses(this.bandSize);
  }

  get overflowItems(): CardActionsOverflowItem[] {
    const items: CardActionsOverflowItem[] = [];
    if (this.showReminder) {
      items.push({
        id: 'reminder',
        label: this.hasReminder ? 'Manage prayer reminders' : 'Add prayer reminder',
        icon: 'bell',
        tone: 'blue',
        filled: this.hasReminder,
        tourAnchorId: this.reminderBellTourId,
        onSelect: () => this.reminder.emit(),
      });
    }
    if (this.isPersonal) {
      items.push({
        id: 'answered',
        label: this.isAnswered ? 'Mark as unanswered' : 'Mark as answered',
        icon: 'check',
        tone: this.isAnswered ? 'green' : 'gray',
        tourAnchorId: this.personalAnsweredTourId,
        onSelect: () => this.toggleAnswered.emit(),
      });
      items.push({
        id: 'share',
        label: 'Share prayer to public',
        ariaLabel: 'Share personal prayer',
        icon: 'share',
        tone: 'blue',
        onSelect: () => this.share.emit(),
      });
      items.push({
        id: 'edit',
        label: 'Edit prayer',
        ariaLabel: 'Edit personal prayer',
        icon: 'edit',
        tone: 'blue',
        tourAnchorId: this.personalEditTourId,
        onSelect: () => this.edit.emit(),
      });
    }
    if (this.showDelete) {
      items.push({
        id: 'delete',
        label: 'Delete prayer',
        ariaLabel: 'Delete prayer request',
        icon: 'trash',
        tone: 'red',
        tourAnchorId: this.personalDeleteTourId,
        onSelect: () => this.delete.emit(),
      });
    }
    return items;
  }
}
