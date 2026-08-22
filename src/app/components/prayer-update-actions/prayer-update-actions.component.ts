import { Component, ChangeDetectionStrategy, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import type { PrayerUpdateRecord } from '../../lib/prayer-update-header';
import { type MetaHeaderBandSize } from '../../lib/prayer-card-layout';
import { CardActionsOverflowMenuComponent } from '../card-actions-overflow-menu/card-actions-overflow-menu.component';
import type { CardActionsOverflowItem } from '../card-actions-overflow-menu/card-actions-overflow-menu.types';

export type PrayerUpdateActionsMode = 'personal' | 'readonly';

@Component({
  selector: 'app-prayer-update-actions',
  standalone: true,
  imports: [CardActionsOverflowMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card-actions-overflow-menu
      [items]="overflowItems"
      [bandSize]="bandSize"
    />
  `,
})
export class PrayerUpdateActionsComponent {
  @Input({ required: true }) update!: PrayerUpdateRecord;
  @Input() mode: PrayerUpdateActionsMode = 'readonly';
  @Input() showDelete = false;
  @Input() bandSize: MetaHeaderBandSize = 'sm';

  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() toggleAnswered = new EventEmitter<void>();

  @HostBinding('class')
  get hostClasses(): string {
    return 'inline-flex items-center justify-end';
  }

  get overflowItems(): CardActionsOverflowItem[] {
    const items: CardActionsOverflowItem[] = [];
    switch (this.mode) {
      case 'personal':
        items.push({
          id: 'edit',
          label: 'Edit update',
          ariaLabel: 'Edit prayer update',
          icon: 'edit',
          tone: 'blue',
          onSelect: () => this.edit.emit(),
        });
        break;
      case 'readonly':
        break;
      default: {
        const _exhaustive: never = this.mode;
        return _exhaustive;
      }
    }
    if (this.showDelete) {
      items.push({
        id: 'delete',
        label: 'Delete update',
        ariaLabel: 'Delete prayer update',
        icon: 'trash',
        tone: 'red',
        onSelect: () => this.delete.emit(),
      });
    }
    return items;
  }
}
