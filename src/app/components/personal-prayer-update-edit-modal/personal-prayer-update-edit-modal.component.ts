import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ChangeDetectorRef,
  OnChanges,
  ViewChild,
  DestroyRef,
  ChangeDetectionStrategy,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PrayerService, PrayerUpdate } from "../../services/prayer.service";
import { ToastService } from "../../services/toast.service";
import { RichTextEditorsSettingsService } from "../../services/rich-text-editors-settings.service";
import { RichTextEditorComponent } from "../rich-text-editor/rich-text-editor.component";
import { ModalShellComponent } from "../modal-shell/modal-shell.component";

@Component({
  selector: "app-personal-prayer-update-edit-modal",
  standalone: true,
  imports: [CommonModule, FormsModule, RichTextEditorComponent, ModalShellComponent],
  template: `
    @if (isOpen && update) {
    <app-modal-shell
      title="Edit Prayer Update"
      titleId="edit-update-title"
      closeAriaLabel="Close edit dialog"
      (close)="onModalClose()"
    >
      <form
        #editForm="ngForm"
        (ngSubmit)="editForm.valid && handleSubmit()"
        class="p-6 space-y-4"
      >
        <div>
          <label
            for="content"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Update Content <span aria-label="required">*</span>
          </label>
          @if (richTextEditorsEnabled) {
          <app-rich-text-editor
            #contentEditor
            [(ngModel)]="formData.content"
            name="content"
            ngDefaultControl
            required
            ariaLabel="Prayer update content"
            placeholder="Update details…"
            minHeight="8rem"
          ></app-rich-text-editor>
          } @else {
          <textarea
            id="content"
            name="content"
            [(ngModel)]="formData.content"
            required
            rows="10"
            aria-label="Prayer update content"
            placeholder="Update details…"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-inset-surface text-gray-900 dark:text-gray-100 min-h-[8rem] whitespace-pre-wrap"
          ></textarea>
          }
        </div>

        <div class="flex justify-end pt-4">
          <button
            type="submit"
            [disabled]="!editForm.valid || isSubmitting || !canSubmitUpdate()"
            class="min-h-12 px-8 py-3 text-base font-medium btn-chip btn-chip-green disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Save changes"
          >
            {{ isSubmitting ? "Saving..." : "Save Changes" }}
          </button>
        </div>
      </form>
    </app-modal-shell>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [],
})
export class PersonalPrayerUpdateEditModalComponent
  implements OnInit, OnChanges
{
  @ViewChild("contentEditor") contentEditor?: RichTextEditorComponent;

  @Input() isOpen = false;
  @Input() update: PrayerUpdate | null = null;
  @Input() prayerId = "";
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Partial<PrayerUpdate>>();

  formData = {
    content: "",
  };

  isSubmitting = false;
  richTextEditorsEnabled = true;

  constructor(
    private prayerService: PrayerService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private destroyRef: DestroyRef,
    richTextEditorsSettings: RichTextEditorsSettingsService
  ) {
    richTextEditorsSettings
      .getRichTextEditorsEnabled$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        this.richTextEditorsEnabled = v;
        this.cdr.markForCheck();
      });
  }

  ngOnInit(): void {}

  ngOnChanges(): void {
    if (this.isOpen && this.update) {
      this.formData = {
        content: this.update.content,
      };
    }
  }

  canSubmitUpdate(): boolean {
    return (this.formData.content ?? "").trim().length > 0;
  }

  async handleSubmit(): Promise<void> {
    if (this.isSubmitting || !this.update) return;

    const content =
      this.contentEditor?.flushMarkdownToForm() ?? this.formData.content ?? "";
    if (!content.trim()) {
      this.toast.error("Update content is required");
      return;
    }

    try {
      this.isSubmitting = true;
      this.cdr.markForCheck();

      const updates: Partial<PrayerUpdate> = {
        content,
      };

      const success = await this.prayerService.updatePersonalPrayerUpdate(
        this.update.id,
        this.prayerId,
        updates
      );

      if (success) {
        this.save.emit(updates);
        this.close.emit();
      }
    } catch (error) {
      console.error("Error updating prayer update:", error);
      this.toast.error("Failed to save prayer update. Please try again.");
    } finally {
      this.isSubmitting = false;
      this.cdr.markForCheck();
    }
  }

  cancel(): void {
    this.formData = {
      content: "",
    };
    this.close.emit();
  }

  onModalClose(): void {
    if (this.isSubmitting) return;
    this.cancel();
  }
}
