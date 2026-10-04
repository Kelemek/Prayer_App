import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  HOME_INFO_PREVIEW_PROMPTS_CARD_SHELL_CLASS,
  HOME_PROMPTS_CHIP_ACTIVE_CLASS,
} from "../../lib/home-sub-filter-chip-classes";

@Component({
  selector: "app-info-home-filter-preview-prompts-card",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./info-home-filter-preview-prompts-card.component.html",
})
export class InfoHomeFilterPreviewPromptsCardComponent {
  readonly shellClass = HOME_INFO_PREVIEW_PROMPTS_CARD_SHELL_CLASS;
  readonly churchChipClass = HOME_PROMPTS_CHIP_ACTIVE_CLASS;
}
