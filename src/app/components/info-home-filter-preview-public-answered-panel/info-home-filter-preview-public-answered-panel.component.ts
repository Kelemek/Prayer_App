import { Component, EventEmitter, Output } from "@angular/core";
import { InfoPreviewPrayerCardComponent } from "../info-preview-prayer-card/info-preview-prayer-card.component";
import type { InfoHeaderPreviewAction } from "../../lib/info-home-filter-preview.types";

@Component({
  selector: "app-info-home-filter-preview-public-answered-panel",
  standalone: true,
  imports: [InfoPreviewPrayerCardComponent],
  templateUrl: "./info-home-filter-preview-public-answered-panel.component.html",
})
export class InfoHomeFilterPreviewPublicAnsweredPanelComponent {
  @Output() openHeaderPreview = new EventEmitter<InfoHeaderPreviewAction>();
}
