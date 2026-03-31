import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface AccountApprovalRequest {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  affiliation_reason?: string | null;
  approval_status: 'pending' | 'approved' | 'denied';
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-pending-account-approval-card',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-4">
      <!-- Header -->
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            {{ request.first_name }} {{ request.last_name }}
          </h3>
          <div class="text-sm text-gray-500 dark:text-gray-400 space-y-1">
            <p class="break-words">Email: {{ request.email }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">
              Requested: {{ formatDate(request.created_at) }}
            </p>
          </div>
        </div>
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          Pending
        </span>
      </div>

      <!-- Affiliation Reason -->
      @if (request.affiliation_reason) {
      <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
        <p class="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">Church Affiliation</p>
        <p class="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">{{ request.affiliation_reason }}</p>
      </div>
      }

      <!-- Action Buttons -->
      <div class="flex gap-2 flex-wrap">
        @if (!isDenying) {
        <button
          (click)="handleApprove()"
          [disabled]="isApproving"
          class="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          {{ isApproving ? 'Approving...' : 'Approve' }}
        </button>
        }

        @if (!isDenying) {
        <button
          (click)="isDenying = true"
          class="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Deny
        </button>
        }
      </div>

      <!-- Denial Form -->
      @if (isDenying) {
      <div class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Reason for denial (optional)
        </label>
        <textarea
          [(ngModel)]="denialReason"
          rows="3"
          placeholder="Explain why this account request is being denied..."
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-3"
        ></textarea>
        <div class="flex gap-2">
          <button
            (click)="handleDeny()"
            [disabled]="isDenyingInProgress"
            class="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {{ isDenyingInProgress ? 'Denying...' : 'Confirm Denial' }}
          </button>
          <button
            (click)="isDenying = false; denialReason = ''"
            class="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
      }
    </div>
  `,
  styles: []
})
export class PendingAccountApprovalCardComponent {
  @Input() request!: AccountApprovalRequest;
  @Output() approve = new EventEmitter<string>();
  @Output() deny = new EventEmitter<{ id: string; reason: string }>();

  isApproving = false;
  isDenying = false;
  isDenyingInProgress = false;
  denialReason = '';

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  handleApprove() {
    if (this.isApproving) return;
    this.isApproving = true;
    this.approve.emit(this.request.id);
  }

  handleDeny() {
    if (this.isDenyingInProgress) return;
    this.isDenyingInProgress = true;
    this.deny.emit({ id: this.request.id, reason: this.denialReason.trim() });
  }
}
