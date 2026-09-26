import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login-registration-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div
      class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800 space-y-4 shadow-xl"
    >
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Welcome! Please provide your information
        </h4>
        @if (requiresApproval) {
          <div
            class="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md mb-4"
          >
            <div class="text-xs text-amber-800 dark:text-amber-200">
              <p class="font-medium mb-1">Admin Approval Required</p>
              <p>
                After submitting your information, an administrator will need to approve your
                account before you can access the application.
              </p>
            </div>
          </div>
        } @else {
          <p class="text-xs text-gray-600 dark:text-gray-400 mb-4">
            We need your name to complete your account registration.
          </p>
        }
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          First Name <span class="text-red-600">*</span>
        </label>
        <input
          type="text"
          [(ngModel)]="firstName"
          (ngModelChange)="firstNameChange.emit($event)"
          placeholder="Your first name"
          [disabled]="loading"
          class="w-full px-4 py-3 border-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-emerald-400 dark:border-emerald-600"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Last Name <span class="text-red-600">*</span>
        </label>
        <input
          type="text"
          [(ngModel)]="lastName"
          (ngModelChange)="lastNameChange.emit($event)"
          placeholder="Your last name"
          [disabled]="loading"
          class="w-full px-4 py-3 border-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-emerald-400 dark:border-emerald-600"
        />
      </div>

      @if (requiresApproval) {
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            How are you affiliated with the church? <span class="text-red-600">*</span>
          </label>
          <textarea
            [(ngModel)]="affiliationReason"
            (ngModelChange)="affiliationChange.emit($event)"
            placeholder="Please explain your connection to this church (for example visitor, attender, or family of a member)"
            rows="3"
            [disabled]="loading"
            class="w-full px-4 py-3 border-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-emerald-400 dark:border-emerald-600 resize-none"
          ></textarea>
        </div>
      }

      @if (error) {
        <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      }

      <button
        type="button"
        (click)="submit.emit()"
        [disabled]="loading || !canSubmit"
        class="w-full py-3 px-4 rounded-md text-sm btn-chip btn-chip-green disabled:opacity-50"
      >
        {{ loading ? 'Saving...' : 'Complete Registration' }}
      </button>
    </div>
  `,
})
export class LoginRegistrationFormComponent {
  @Input() requiresApproval = false;
  @Input() loading = false;
  @Input() error = '';
  @Input() firstName = '';
  @Input() lastName = '';
  @Input() affiliationReason = '';

  @Output() firstNameChange = new EventEmitter<string>();
  @Output() lastNameChange = new EventEmitter<string>();
  @Output() affiliationChange = new EventEmitter<string>();
  @Output() submit = new EventEmitter<void>();

  get canSubmit(): boolean {
    if (!this.firstName.trim() || !this.lastName.trim()) {
      return false;
    }
    if (this.requiresApproval && !this.affiliationReason.trim()) {
      return false;
    }
    return true;
  }
}
