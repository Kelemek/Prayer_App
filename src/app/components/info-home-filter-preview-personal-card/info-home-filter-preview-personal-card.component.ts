import { Component, EventEmitter, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import type { InfoPersonalActionPreview } from "../../lib/info-home-filter-preview.types";
import { CardActionsOverflowMenuComponent } from "../card-actions-overflow-menu/card-actions-overflow-menu.component";
import type { CardActionsOverflowItem } from "../card-actions-overflow-menu/card-actions-overflow-menu.types";
import { CardMetaHeaderBandComponent } from "../card-meta-header-band/card-meta-header-band.component";
import {
  getPrayerCardVariantLayout,
  PRAYER_CARD_PERSONAL_CATEGORY_HEADER_INSET_CLASSES,
  PRAYER_CARD_PERSONAL_CATEGORY_HEADER_TEXT_CLASSES,
} from "../../lib/prayer-card-layout";
import { HOME_SHELL_SECTION_GAP_CLASSES } from "../../lib/home-shell-spacing";
import { getPrayerCardShellClasses } from "../../lib/prayer-card-shell";
import { PERSONAL_PRAYER_BORDER_CLASSES } from "../../lib/prayer-status-header";
import { formatPrayerCardShortDateParts } from "../../lib/prayer-update-header";
import {
  getPersonalCategoryColor,
  personalCategoryHeaderBandStyles,
} from "../../../utils/personalCategoryColor";

@Component({
  selector: "app-info-home-filter-preview-personal-card",
  standalone: true,
  imports: [
    CommonModule,
    CardMetaHeaderBandComponent,
    CardActionsOverflowMenuComponent,
  ],
  templateUrl: "./info-home-filter-preview-personal-card.component.html",
})
export class InfoHomeFilterPreviewPersonalCardComponent {
  @Output() openPersonalAction = new EventEmitter<InfoPersonalActionPreview>();

  readonly createdAt = "2025-01-14T12:00:00";
  readonly category = "Health";
  readonly layout = getPrayerCardVariantLayout("home");
  readonly headerInsetClasses = PRAYER_CARD_PERSONAL_CATEGORY_HEADER_INSET_CLASSES;
  readonly headerTextClasses = PRAYER_CARD_PERSONAL_CATEGORY_HEADER_TEXT_CLASSES;
  readonly categoryStyles = personalCategoryHeaderBandStyles(
    getPersonalCategoryColor(this.category)
  );

  readonly overflowItems: CardActionsOverflowItem[] = [
    {
      id: "answered",
      label: "Mark as answered",
      icon: "check",
      tone: "gray",
      onSelect: () => this.openPersonalAction.emit("answered"),
    },
    {
      id: "edit",
      label: "Edit prayer",
      icon: "edit",
      tone: "blue",
      onSelect: () => this.openPersonalAction.emit("edit"),
    },
    {
      id: "delete",
      label: "Delete prayer",
      icon: "trash",
      tone: "red",
      onSelect: () => this.openPersonalAction.emit("delete"),
    },
  ];

  get shellClasses(): string {
    return getPrayerCardShellClasses("home", PERSONAL_PRAYER_BORDER_CLASSES)
      .replace(HOME_SHELL_SECTION_GAP_CLASSES, "")
      .trim();
  }

  get headerDateParts(): { date: string; time: string } {
    return formatPrayerCardShortDateParts(this.createdAt);
  }
}