import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

@Component({
  selector: 'app-admin-collapsible-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
      [class.cursor-pointer]="!expanded"
      (click)="!expanded && onToggle()"
    >
      <button
        type="button"
        [id]="triggerId"
        class="admin-settings-collapsible-trigger cursor-pointer w-full flex min-h-12 items-center justify-between gap-2 text-left rounded-lg -mx-1 px-1 py-0.5 -my-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
        (click)="onToggle(); $event.stopPropagation()"
        [attr.aria-expanded]="expanded"
        [attr.aria-controls]="panelId"
      >
        <span
          class="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 min-w-0"
        >
          <ng-content select="[sectionIcon]" />
          {{ title }}
        </span>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0 text-gray-500 dark:text-gray-400 transition-transform duration-200"
          [class.rotate-180]="expanded"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      @if (expanded) {
        <div
          [id]="panelId"
          role="region"
          [attr.aria-labelledby]="triggerId"
          class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
          (click)="$event.stopPropagation()"
        >
          <ng-content />
        </div>
      }
    </div>
  `,
})
export class AdminCollapsibleSectionComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) triggerId!: string;
  @Input({ required: true }) panelId!: string;
  @Input() expanded = false;

  @Output() expandedChange = new EventEmitter<boolean>();

  onToggle(): void {
    this.expandedChange.emit(!this.expanded);
  }
}
