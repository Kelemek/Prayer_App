import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PersonalCategoryColorPickerComponent } from "../personal-category-color-picker/personal-category-color-picker.component";
import { PERSONAL_CATEGORY_COLOR_PRESETS } from "../../../utils/personalCategoryColor";

export type CreatePersonalCategoryPayload = {
  name: string;
  color: string;
};

@Component({
  selector: "app-home-personal-category-editor-modal",
  standalone: true,
  imports: [CommonModule, FormsModule, PersonalCategoryColorPickerComponent],
  templateUrl: "./home-personal-category-editor-modal.component.html",
  host: { class: "contents" },
})
export class HomePersonalCategoryEditorModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() submitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() createCategory = new EventEmitter<CreatePersonalCategoryPayload>();

  nameDraft = "";
  colorDraft = PERSONAL_CATEGORY_COLOR_PRESETS[0]!;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["isOpen"]?.currentValue === true) {
      this.nameDraft = "";
      this.colorDraft = PERSONAL_CATEGORY_COLOR_PRESETS[0]!;
    }
  }

  onColorChange(color: string): void {
    this.colorDraft = color;
  }

  submitCreate(): void {
    const name = this.nameDraft.trim();
    if (!name || this.submitting) {
      return;
    }
    this.createCategory.emit({ name, color: this.colorDraft });
  }
}
