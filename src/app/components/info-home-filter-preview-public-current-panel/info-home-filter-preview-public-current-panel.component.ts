import { Component, EventEmitter, Output } from "@angular/core";
import { InfoPreviewPrayerCardComponent } from "../info-preview-prayer-card/info-preview-prayer-card.component";
import type { InfoHeaderPreviewAction } from "../../lib/info-home-filter-preview.types";
import type { PrayerUpdateRecord } from "../../lib/prayer-update-header";

@Component({
  selector: "app-info-home-filter-preview-public-current-panel",
  standalone: true,
  imports: [InfoPreviewPrayerCardComponent],
  templateUrl: "./info-home-filter-preview-public-current-panel.component.html",
})
export class InfoHomeFilterPreviewPublicCurrentPanelComponent {
  @Output() openBadges = new EventEmitter<void>();
  @Output() openHeaderPreview = new EventEmitter<InfoHeaderPreviewAction>();

  readonly previewUpdate: PrayerUpdateRecord = {
    id: "info-preview-update",
    content:
      "Prayer updates let you share progress, answered prayers, or new developments with the community. Click Add Update on a request to post one. You can also mark a prayer as answered from an update.",
    author: "Someone",
    created_at: "2025-01-10T14:20:00",
  };
}