import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Centered spinner + message for admin settings cards while async data loads.
 */
@Component({
  selector: 'app-admin-section-loading',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col items-center justify-center gap-3 py-10"
      role="status"
      aria-live="polite"
    >
      <div
        class="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400"
        aria-hidden="true"
      ></div>
      <p class="text-sm text-gray-600 dark:text-gray-400 text-center px-2 max-w-md">
        {{ message }}
      </p>
    </div>
  `,
})
export class AdminSectionLoadingComponent {
  @Input() message = 'Loading…';
}
