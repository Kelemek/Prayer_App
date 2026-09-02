import { Component, EventEmitter, Output } from "@angular/core";
import { InfoPreviewPrayerCardComponent } from "../info-preview-prayer-card/info-preview-prayer-card.component";
import type { InfoHeaderPreviewAction } from "../../lib/info-home-filter-preview.types";

@Component({
  selector: "app-info-home-filter-preview-public-total-panel",
  standalone: true,
  imports: [InfoPreviewPrayerCardComponent],
  templateUrl: "./info-home-filter-preview-public-total-panel.component.html",
})
export class InfoHomeFilterPreviewPublicTotalPanelComponent {
  @Output() openHeaderPreview = new EventEmitter<InfoHeaderPreviewAction>();
}
