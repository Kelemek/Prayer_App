import { Component, EventEmitter, Input, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  HOME_GROUPS_SUB_FILTER_GROUP_CLASS,
  HOME_MEMORIZE_SUB_FILTER_GROUP_CLASS,
  HOME_PUBLIC_STATUS_CHIP_HOST_CLASS,
  HOME_PUBLIC_STATUS_CHIP_ROW_CLASS,
  HOME_PUBLIC_STATUS_CHIP_THEMES,
  HOME_PUBLIC_SUB_FILTER_GROUP_CLASS,
  HOME_SUB_FILTER_CHIP_ROW_CLASS,
  HOME_SUB_FILTER_CHIP_WRAP_STRETCH_CLASS,
  HOME_WRAP_FILTER_CHIP_FLEX_CLASS,
  homeFilterTabClass,
} from "../../lib/home-sub-filter-chip-classes";
import { buildHomeSubFilterChipButtonClass } from "../../lib/home-sub-filter-chip-button-class";
import {
  isGroupsPreviewFilter,
  isMemorizePreviewFilter,
  isPublicAreaPreviewFilter,
  isPublicPreviewFilter,
  type InfoMemorizeActionPreview,
  type InfoPreviewFilter,
} from "../../lib/info-home-filter-preview.types";
import { InfoHomeFilterPreviewPersonalFiltersComponent } from "../info-home-filter-preview-personal-filters/info-home-filter-preview-personal-filters.component";
import { InfoHomeFilterPreviewPromptsFiltersComponent } from "../info-home-filter-preview-prompts-filters/info-home-filter-preview-prompts-filters.component";

@Component({
  selector: "app-info-home-filter-preview-tabs",
  standalone: true,
  imports: [
    CommonModule,
    InfoHomeFilterPreviewPersonalFiltersComponent,
    InfoHomeFilterPreviewPromptsFiltersComponent,
  ],
  templateUrl: "./info-home-filter-preview-tabs.component.html",
  host: { class: "block" },
})
export class InfoHomeFilterPreviewTabsComponent {
  /** When false, hide Public area tabs (matches home filter gating for personal-only tenants). */
  @Input() canAccessShared = true;
  /** When false, hide Groups (matches home for users with no groups). */
  @Input() canAccessGroupsTab = true;
  @Input() previewFilter: InfoPreviewFilter = "current";
  @Output() previewFilterChange = new EventEmitter<InfoPreviewFilter>();
  @Output() openBadges = new EventEmitter<void>();
  @Output() openPromptCategories = new EventEmitter<void>();
  @Output() openPersonalCategories = new EventEmitter<void>();
  @Output() openMemorizeAction = new EventEmitter<InfoMemorizeActionPreview>();

  readonly chipHostClass = HOME_WRAP_FILTER_CHIP_FLEX_CLASS;
  readonly publicChipHostClass = HOME_PUBLIC_STATUS_CHIP_HOST_CLASS;
  readonly publicChipRowClass = HOME_PUBLIC_STATUS_CHIP_ROW_CLASS;
  readonly chipButtonClass = HOME_SUB_FILTER_CHIP_WRAP_STRETCH_CLASS;
  readonly chipRowClass = HOME_SUB_FILTER_CHIP_ROW_CLASS;
  readonly chipThemes = HOME_PUBLIC_STATUS_CHIP_THEMES;
  readonly publicSubFilterGroupClass = HOME_PUBLIC_SUB_FILTER_GROUP_CLASS;

  isPublicAreaActive(): boolean {
    return isPublicAreaPreviewFilter(this.previewFilter);
  }

  publicTabClass(): string {
    return homeFilterTabClass({
      accent: "public",
      active: this.isPublicAreaActive(),
      hasSubRow: true,
    });
  }

  personalTabClass(): string {
    return homeFilterTabClass({
      accent: "personal",
      active: this.previewFilter === "personal",
      hasSubRow: true,
    });
  }

  groupsTabClass(): string {
    return homeFilterTabClass({
      accent: "groups",
      active: isGroupsPreviewFilter(this.previewFilter),
      hasSubRow: true,
    });
  }

  memorizeTabClass(): string {
    return homeFilterTabClass({
      accent: "memorize",
      active: isMemorizePreviewFilter(this.previewFilter),
      hasSubRow: true,
    });
  }

  groupsPanelGroupClass(): string {
    return HOME_GROUPS_SUB_FILTER_GROUP_CLASS;
  }

  memorizePanelGroupClass(): string {
    return HOME_MEMORIZE_SUB_FILTER_GROUP_CLASS;
  }

  groupChipClass(active: boolean): string {
    const theme = this.chipThemes.members;
    return buildHomeSubFilterChipButtonClass({
      base: this.chipButtonClass,
      active,
      activeClass: theme.active,
      inactiveClass: theme.inactive,
    });
  }

  memorizeChipClass(active: boolean): string {
    return this.groupChipClass(active);
  }

  publicPanelGroupClass(): string {
    const shape =
      this.previewFilter === "prompts" ? "rounded-b-none" : "rounded-b-lg";
    return `${this.publicSubFilterGroupClass} ${shape}`;
  }

  subFilterChipClass(
    filter: "current" | "answered" | "archived" | "total" | "prompts"
  ): string {
    const theme = this.chipThemes[filter];
    const active = this.previewFilter === filter;
    return buildHomeSubFilterChipButtonClass({
      base: this.chipButtonClass,
      active,
      activeClass: theme.active,
      inactiveClass: theme.inactive,
    });
  }

  selectPublicPreviewTab(): void {
    if (!isPublicPreviewFilter(this.previewFilter)) {
      this.previewFilterChange.emit("current");
    }
  }

  setPreviewFilter(filter: InfoPreviewFilter): void {
    this.previewFilterChange.emit(filter);
  }
}
