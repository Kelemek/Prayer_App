import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BiblePassagePickerModalComponent } from '../bible-passage-picker-modal/bible-passage-picker-modal.component';
import { ScriptureService } from '../../services/scripture.service';
import { MemorizationService } from '../../services/memorization.service';
import { ToastService } from '../../services/toast.service';
import type { BibleTranslation } from '../../types/memorization';

@Component({
  selector: 'app-add-memorized-verse-modal',
  standalone: true,
  imports: [CommonModule, BiblePassagePickerModalComponent],
  template: `
    <app-bible-passage-picker-modal
      [isOpen]="isOpen"
      [busy]="adding"
      confirmLabel="Add"
      (close)="onClose.emit()"
      (confirmed)="onPassageConfirmed($event)"
      (translationChange)="translationChange.emit($event)"
    />
  `,
})
export class AddMemorizedVerseModalComponent {
  @Input() isOpen = false;
  @Output() onClose = new EventEmitter<void>();
  @Output() added = new EventEmitter<void>();
  @Output() translationChange = new EventEmitter<BibleTranslation>();

  adding = false;

  constructor(
    private scripture: ScriptureService,
    private memorization: MemorizationService,
    private toast: ToastService
  ) {}

  async onPassageConfirmed(reference: string): Promise<void> {
    if (this.adding) return;
    this.adding = true;
    try {
      const translation = this.memorization.getPreferredTranslation();
      // Validate the passage resolves before saving a reference-only row.
      const passage = await this.scripture.getPassage(reference, translation);
      const text = passage.text?.trim();
      if (!text) {
        this.toast.error('No text returned for this passage.');
        return;
      }
      const result = await this.memorization.addVerse(reference, translation, text);
      if (result.ok) {
        this.toast.success('Added to memorization list.');
        this.added.emit();
        this.onClose.emit();
      } else if (result.reason === 'duplicate') {
        this.toast.error('This passage is already in your memorization list.');
      } else {
        this.toast.error('Could not save this passage.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add passage.';
      this.toast.error(msg);
    } finally {
      this.adding = false;
    }
  }
}
