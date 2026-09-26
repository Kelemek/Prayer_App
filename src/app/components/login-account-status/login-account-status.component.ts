import { Component, Input } from '@angular/core';

export type LoginAccountStatusKind = 'pending_approval' | 'blocked';

@Component({
  selector: 'app-login-account-status',
  standalone: true,
  template: `
    <div
      class="bg-white dark:bg-gray-800 rounded-lg p-4 border shadow-xl"
      [class.border-emerald-200]="kind === 'pending_approval'"
      [class.border-amber-200]="kind === 'blocked'"
    >
      @if (kind === 'pending_approval') {
        <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Account Approval Request Submitted
        </h4>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Your account request has been submitted successfully. An administrator will review your
          information and you'll receive an email once your account has been approved.
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          You can close this window now. Please check your email for updates.
        </p>
      } @else {
        <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Account Access Restricted
        </h4>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Your account has been temporarily restricted and you are unable to access the prayer
          community at this time.
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Please contact an administrator for assistance in restoring your account access.
        </p>
      }
    </div>
  `,
})
export class LoginAccountStatusComponent {
  @Input({ required: true }) kind!: LoginAccountStatusKind;
}
