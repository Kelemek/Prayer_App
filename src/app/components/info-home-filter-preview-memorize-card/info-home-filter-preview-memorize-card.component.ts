import { Component, EventEmitter, Output } from "@angular/core";
import { HOME_INFO_PREVIEW_MEMORIZE_CARD_SHELL_CLASS } from "../../lib/home-sub-filter-chip-classes";

@Component({
  selector: "app-info-home-filter-preview-memorize-card",
  standalone: true,
  templateUrl: "./info-home-filter-preview-memorize-card.component.html",
})
export class InfoHomeFilterPreviewMemorizeCardComponent {
  readonly shellClass = HOME_INFO_PREVIEW_MEMORIZE_CARD_SHELL_CLASS;

  @Output() openPracticePreview = new EventEmitter<void>();
}
