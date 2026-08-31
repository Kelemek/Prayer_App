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

@Component({
  selector: "app-home-group-editor-modal",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./home-group-editor-modal.component.html",
  host: { class: "contents" },
})
export class HomeGroupEditorModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() submitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() createGroup = new EventEmitter<string>();

  nameDraft = "";

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["isOpen"]?.currentValue === true) {
      this.nameDraft = "";
    }
  }

  submitCreate(): void {
    const name = this.nameDraft.trim();
    if (!name) return;
    this.createGroup.emit(name);
  }
}
