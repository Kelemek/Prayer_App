import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { PrayerUpdate } from '../../services/prayer.service';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';

@Component({
  selector: 'app-admin-update-deny-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, RichTextEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen && update) {
      <div class="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deny-update-title"
        >
          <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 id="deny-update-title" class="text-xl font-semibold text-gray-800 dark:text-gray-200">
              Deny Prayer Update
            </h2>
            <button
              type="button"
              (click)="cancel()"
              aria-label="Close deny dialog"
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1 cursor-pointer"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <form #denyForm="ngForm" (ngSubmit)="handleSubmit()" class="p-6 space-y-4">
            <p class="text-sm text-gray-600 dark:text-gray-300">
              You are about to deny this update. The author can be notified with an optional reason.
            </p>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason for denial (optional)
              </label>
              <app-rich-text-editor
                [(ngModel)]="denialReason"
                name="denialReason"
                ngDefaultControl
                ariaLabel="Reason for denial"
                placeholder="Explain why this update is being denied..."
                minHeight="8rem"
              ></app-rich-text-editor>
            </div>

            <div class="flex gap-3 pt-2">
              <button
                type="submit"
                class="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors cursor-pointer"
              >
                Confirm Denial
              </button>
              <button
                type="button"
                (click)="cancel()"
                class="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class AdminUpdateDenyModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() update: PrayerUpdate | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<string | null>();

  @ViewChild(RichTextEditorComponent) denialReasonEditor?: RichTextEditorComponent;

  denialReason = '';

  ngOnChanges(): void {
    if (this.isOpen && this.update) {
      this.denialReason = '';
    }
  }

  handleSubmit(): void {
    this.denialReasonEditor?.flushMarkdownToForm();
    const reason = this.denialReason.trim();
    this.confirm.emit(reason || null);
    this.close.emit();
  }

  cancel(): void {
    this.denialReason = '';
    this.close.emit();
  }
}
