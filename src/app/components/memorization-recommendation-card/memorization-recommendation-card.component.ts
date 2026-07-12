import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { MemorizationRecommendation } from '../../types/memorization';
import { ScriptureHoverPreviewComponent } from '../scripture-hover-preview/scripture-hover-preview.component';

@Component({
  selector: 'app-memorization-recommendation-card',
  standalone: true,
  imports: [CommonModule, ScriptureHoverPreviewComponent],
  template: `
    <app-scripture-hover-preview
      [reference]="recommendation.reference"
      [translation]="recommendation.translation"
    >
      <button
        type="button"
        class="w-full text-left bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 mb-3 px-4 py-3 transition-colors"
        [class.hover:bg-gray-50]="!alreadyAdded"
        [class.dark:hover:bg-gray-700/50]="!alreadyAdded"
        [class.cursor-pointer]="!alreadyAdded"
        [class.cursor-not-allowed]="alreadyAdded"
        [class.opacity-70]="alreadyAdded"
        [disabled]="alreadyAdded || busy"
        (click)="onClick()"
        [attr.aria-label]="
          alreadyAdded
            ? recommendation.reference + ' already added'
            : 'Add ' + recommendation.reference + ' to memorize'
        "
      >
        <span class="font-semibold text-gray-900 dark:text-gray-100 block truncate">
          {{ recommendation.reference }}
        </span>
        <span class="text-xs text-gray-600 dark:text-gray-400 mt-0.5 block">
          @if (alreadyAdded) {
            Already added
          } @else {
            {{ recommendation.translation.toUpperCase() }} · Tap to add
          }
        </span>
      </button>
    </app-scripture-hover-preview>
  `,
})
export class MemorizationRecommendationCardComponent {
  @Input({ required: true }) recommendation!: MemorizationRecommendation;
  @Input() alreadyAdded = false;
  @Input() busy = false;
  @Output() add = new EventEmitter<MemorizationRecommendation>();

  onClick(): void {
    if (this.alreadyAdded || this.busy) return;
    this.add.emit(this.recommendation);
  }
}
