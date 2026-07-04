import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrayerCardComponent } from '../prayer-card/prayer-card.component';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';
import type { PrayerRequest } from '../../services/prayer.service';
import { AdminDataService } from '../../services/admin-data.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-admin-prayer-approval',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, PrayerCardComponent, RichTextEditorComponent],
  template: `
    <div class="space-y-4">
      <!-- Prayer Card -->
      <app-prayer-card
        [prayer]="prayer"
        [isPersonal]="false"
        (delete)="onDelete.emit($event)"
        (edit)="onEdit.emit($event)"
        (toggleUpdateAnswered)="onToggleUpdateAnswered.emit($event)"
        (toggleMemberUpdateAnswered)="onToggleMemberUpdateAnswered.emit($event)"
      ></app-prayer-card>

      <!-- Inline Description Edit (quick fix before approving) -->
      @if (isEditingDescription) {
        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 space-y-3">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Edit prayer description
          </label>
          <app-rich-text-editor
            [(ngModel)]="editedDescription"
            name="approvalEditedDescription"
            ngDefaultControl
            ariaLabel="Prayer description"
            placeholder="Prayer request details"
            minHeight="5rem"
          ></app-rich-text-editor>
          <div class="flex gap-2 justify-end">
            <button
              type="button"
              (click)="saveDescription()"
              [disabled]="isSavingDescription"
              class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >{{ isSavingDescription ? 'Saving…' : 'Save' }}</button>
            <button
              type="button"
              (click)="cancelDescriptionEdit()"
              [disabled]="isSavingDescription"
              class="px-3 py-1.5 text-sm bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors font-medium"
            >Cancel</button>
          </div>
        </div>
      }

      <!-- Denial Form -->
      @if (isDenying) {
        <div class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason for denial (optional)
          </label>
          <textarea
            [(ngModel)]="denialReason"
            rows="3"
            placeholder="Explain why this prayer request is being denied..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-3"
          ></textarea>
        </div>
      }

      <!-- Admin Action Buttons -->
      <div class="flex flex-wrap gap-3 justify-end bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        @if (!isDenying && !isEditingDescription) {
          <button
            type="button"
            (click)="startDescriptionEdit()"
            title="Edit the prayer description before approving"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Edit Description
          </button>
          <button
            (click)="isDenying = true"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Deny
          </button>
          <button
            (click)="onApprove.emit(prayer.id)"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Approve
          </button>
        } @else if (isDenying) {
          <button
            (click)="handleDeny()"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Confirm Denial
          </button>
          <button
            (click)="isDenying = false; denialReason = ''"
            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Cancel
          </button>
        }
      </div>
    </div>
  `,
  styles: []
})
export class AdminPrayerApprovalComponent {
  @Input() prayer!: PrayerRequest;

  @Output() onApprove = new EventEmitter<string>();
  @Output() onDeny = new EventEmitter<{ id: string; reason: string | null }>();
  @Output() onEdit = new EventEmitter<{ id: string; updates: { description?: string } }>();
  @Output() onDelete = new EventEmitter<string>();
  @Output() onToggleUpdateAnswered = new EventEmitter<unknown>();
  @Output() onToggleMemberUpdateAnswered = new EventEmitter<unknown>();

  isDenying = false;
  denialReason = '';
  isEditingDescription = false;
  isSavingDescription = false;
  editedDescription = '';

  constructor(
    private adminDataService: AdminDataService,
    private toast: ToastService,
    @Inject(ChangeDetectorRef) private cdr: ChangeDetectorRef,
  ) {}

  startDescriptionEdit(): void {
    this.editedDescription = this.prayer.description || '';
    this.isEditingDescription = true;
  }

  cancelDescriptionEdit(): void {
    this.isEditingDescription = false;
    this.editedDescription = '';
  }

  async saveDescription(): Promise<void> {
    if (this.isSavingDescription) return;
    this.isSavingDescription = true;
    this.cdr.markForCheck();
    try {
      await this.adminDataService.editPrayer(this.prayer.id, { description: this.editedDescription });
      this.prayer = { ...this.prayer, description: this.editedDescription };
      this.onEdit.emit({ id: this.prayer.id, updates: { description: this.editedDescription } });
      this.isEditingDescription = false;
      this.toast.success('Description updated.');
    } catch (err) {
      console.error('Failed to update prayer description:', err);
      this.toast.error('Failed to update description.');
    } finally {
      this.isSavingDescription = false;
      this.cdr.markForCheck();
    }
  }

  handleDeny(): void {
    this.onDeny.emit({ id: this.prayer.id, reason: this.denialReason || null });
    this.isDenying = false;
    this.denialReason = '';
  }
}
