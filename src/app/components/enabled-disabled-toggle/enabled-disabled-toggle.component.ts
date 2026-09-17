import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  SETTINGS_CHOICE_BTN_CLASS,
  settingsChoiceNgClass,
} from '../../lib/settings-choice-ui';

@Component({
  selector: 'app-enabled-disabled-toggle',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loaded) {
      <div class="grid grid-cols-2 gap-1.5 sm:gap-2">
        <button
          type="button"
          (click)="onSelect(true)"
          [disabled]="saving"
          [ngClass]="choiceState(value === true)"
          [title]="enabledTitle"
          [class]="choiceBtnClass"
        >
          <span class="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-100">{{
            enabledLabel
          }}</span>
        </button>
        <button
          type="button"
          (click)="onSelect(false)"
          [disabled]="saving"
          [ngClass]="choiceState(value === false)"
          [title]="disabledTitle"
          [class]="choiceBtnClass"
        >
          <span class="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-100">{{
            disabledLabel
          }}</span>
        </button>
      </div>
    } @else {
      <div class="grid grid-cols-2 gap-1.5 sm:gap-2">
        <div class="h-12 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"></div>
        <div class="h-12 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"></div>
      </div>
    }
  `,
})
export class EnabledDisabledToggleComponent {
  readonly choiceBtnClass = SETTINGS_CHOICE_BTN_CLASS;
  readonly choiceState = settingsChoiceNgClass;

  @Input() loaded = false;
  @Input() saving = false;
  @Input() value: boolean | null = null;
  @Input() enabledLabel = 'Enabled';
  @Input() disabledLabel = 'Disabled';
  @Input() enabledTitle = '';
  @Input() disabledTitle = '';

  @Output() valueChange = new EventEmitter<boolean>();

  onSelect(next: boolean): void {
    if (this.saving || this.value === next) {
      return;
    }
    this.valueChange.emit(next);
  }
}
