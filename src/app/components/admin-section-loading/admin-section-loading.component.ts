import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Centered spinner + message for admin settings cards while async data loads.
 */
@Component({
  selector: 'app-admin-section-loading',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes admin-section-spin {
        to {
          transform: rotate(360deg);
        }
      }

      .admin-section-spinner {
        animation: admin-section-spin 1s linear infinite;
      }
    `,
  ],
  template: `
    <div
      class="flex flex-col items-center justify-center gap-3 py-10"
      role="status"
      aria-live="polite"
    >
      <div
        class="admin-section-spinner rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent dark:border-blue-400 dark:border-t-transparent"
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
