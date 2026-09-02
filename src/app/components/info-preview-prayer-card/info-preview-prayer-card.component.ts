import { Component, EventEmitter, Input, Output } from "@angular/core";
import { PrayerCardMetaHeaderComponent } from "../prayer-card-meta-header/prayer-card-meta-header.component";
import { PrayerUpdateRowComponent } from "../prayer-update-row/prayer-update-row.component";
import type { InfoHeaderPreviewAction } from "../../lib/info-home-filter-preview.types";
import type { PrayerUpdateRecord } from "../../lib/prayer-update-header";
import { getPrayerCardVariantLayout } from "../../lib/prayer-card-layout";
import { HOME_SHELL_SECTION_GAP_CLASSES } from "../../lib/home-shell-spacing";
import { getPrayerCardShellClasses } from "../../lib/prayer-card-shell";
import { getPrayerStatusBorderClasses } from "../../lib/prayer-status-header";

@Component({
  selector: "app-info-preview-prayer-card",
  standalone: true,
  imports: [PrayerCardMetaHeaderComponent, PrayerUpdateRowComponent],
  templateUrl: "./info-preview-prayer-card.component.html",
})
export class InfoPreviewPrayerCardComponent {
  @Input({ required: true }) status!: "current" | "answered" | "archived";
  @Input({ required: true }) title!: string;
  @Input({ required: true }) requester!: string;
  @Input({ required: true }) createdAt!: string;
  @Input({ required: true }) description!: string;
  @Input() note = "";
  @Input() showPrayFor = false;
  @Input() update: PrayerUpdateRecord | null = null;

  @Output() openBadges = new EventEmitter<void>();
  @Output() openHeaderPreview = new EventEmitter<InfoHeaderPreviewAction>();

  readonly layout = getPrayerCardVariantLayout("home");

  get shellClasses(): string {
    return getPrayerCardShellClasses(
      "home",
      getPrayerStatusBorderClasses(this.status)
    )
      .replace(HOME_SHELL_SECTION_GAP_CLASSES, "")
      .trim();
  }
}
