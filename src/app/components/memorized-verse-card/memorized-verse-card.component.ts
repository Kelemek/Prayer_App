import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  bibleBooksCountLabel,
  isBibleBooksMemorizationItem,
} from '../../lib/memorization/bibleBooksMemorization';
import {
  getMasterLevel,
  masterLevelLabel,
} from '../../lib/memorization/memorization-mastery';
import type { MemorizedItem } from '../../types/memorization';
import { MEMORIZE_REMOVE_BUTTON_TONE_CLASS } from '../../lib/card-action-tone-classes';
import { MEMORIZE_CARD_SHELL_BORDER_CLASS } from '../../lib/home-sub-filter-chip-classes';
import { ScriptureHoverPreviewComponent } from '../scripture-hover-preview/scripture-hover-preview.component';
import { CardActionTrashIconComponent } from '../icons/card-action-trash-icon.component';

/** Fill only — shell border turns blue via {@link MEMORIZE_CARD_SHELL_HOVER_CLASS}. */
const MEMORIZE_CARD_PRACTICE_HOVER =
  'border border-transparent hover:!bg-blue-100 dark:hover:!bg-blue-950';

/** One 1px outline on hover (avoids stacking border + ring on inner controls). */
const MEMORIZE_CARD_SHELL_HOVER_CLASS =
  'transition-colors hover:!border-[#0047AB] dark:hover:!border-[#0047AB]';

@Component({
  selector: 'app-memorized-verse-card',
  standalone: true,
  imports: [
    CommonModule,
    ScriptureHoverPreviewComponent,
    CardActionTrashIconComponent,
  ],
  host: { class: 'block h-full', role: 'listitem' },
  template: `
    <div
      [id]="tourMemorizeAnchors ? 'tour-memorize-sample-card' : null"
      class="h-full flex bg-white dark:bg-gray-800 rounded-lg shadow-md {{ memorizeCardShellBorder }} {{ memorizeCardShellHover }} overflow-hidden"
    >
      <app-scripture-hover-preview
        class="min-w-0 flex-1 h-full"
        [reference]="item.reference"
        [translation]="item.translation"
        [disabled]="isBibleBooksMemorizationItem(item)"
      >
        <button
          type="button"
          data-testid="memorize-card-practice"
          (click)="practice.emit(item)"
          class="w-full h-full min-w-0 text-left px-4 py-3 rounded-l-lg transition-colors cursor-pointer {{ memorizeCardPracticeHover }}"
        >
          <span class="font-semibold text-gray-900 dark:text-gray-100 block truncate">
            {{ item.reference }}
          </span>
          <span class="text-xs text-gray-600 dark:text-gray-400 mt-0.5 block">
            @if (isBibleBooksMemorizationItem(item)) {
              {{ bibleBooksCountLabel(item.bibleBooksScope!) }}
            } @else {
              {{ item.translation.toUpperCase() }}
            }
            @if (item.lastPracticedAt) {
              · Last: {{ formatDate(item.lastPracticedAt) }}
            }
          </span>
          <span class="text-xs text-gray-500 dark:text-gray-500 mt-0.5 block">
            Sessions: {{ completedCount }} completed · {{ masterLabel }}
          </span>
        </button>
      </app-scripture-hover-preview>
      <button
        type="button"
        data-testid="memorize-card-remove"
        (click)="remove.emit(item)"
        class="shrink-0 flex items-center justify-center px-3 rounded-r-lg transition-colors cursor-pointer {{ memorizeCardRemoveHover }}"
        [attr.aria-label]="'Remove ' + item.reference"
        title="Remove"
      >
        <app-card-action-trash-icon />
      </button>
    </div>
  `,
})
export class MemorizedVerseCardComponent {
  @Input({ required: true }) item!: MemorizedItem;
  @Input() tourMemorizeAnchors = false;
  @Output() practice = new EventEmitter<MemorizedItem>();
  @Output() remove = new EventEmitter<MemorizedItem>();

  readonly memorizeCardPracticeHover = MEMORIZE_CARD_PRACTICE_HOVER;
  readonly memorizeCardRemoveHover = MEMORIZE_REMOVE_BUTTON_TONE_CLASS;
  readonly memorizeCardShellBorder = MEMORIZE_CARD_SHELL_BORDER_CLASS;
  readonly memorizeCardShellHover = MEMORIZE_CARD_SHELL_HOVER_CLASS;

  readonly isBibleBooksMemorizationItem = isBibleBooksMemorizationItem;
  readonly bibleBooksCountLabel = bibleBooksCountLabel;

  get completedCount(): number {
    return this.item.practiceSessions.filter((s) => s.completed).length;
  }

  get masterLabel(): string {
    return masterLevelLabel(getMasterLevel(this.item));
  }

  formatDate(ts: number): string {
    try {
      return new Date(ts).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }
}
