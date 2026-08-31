import type { HomeActiveFilter } from "../services/home-deep-link-host.adapter";

export type CommunityPrayerFilter =
  | "current"
  | "answered"
  | "archived"
  | "total";

export function isCommunityPrayerFilter(
  filter: HomeActiveFilter
): filter is CommunityPrayerFilter {
  return (
    filter === "current" ||
    filter === "answered" ||
    filter === "archived" ||
    filter === "total"
  );
}

export type PublicTabFilter = CommunityPrayerFilter;

/** True when a shared/community prayer tab is selected. */
export function isPublicTabFilter(
  filter: HomeActiveFilter
): filter is PublicTabFilter {
  return isCommunityPrayerFilter(filter);
}

/** True when the Public top tab or its sub-tabs (including Prompts) are active. */
export function isPublicAreaFilter(filter: HomeActiveFilter): boolean {
  return isPublicTabFilter(filter) || filter === "prompts";
}

/** True when the Groups top tab is selected. */
export function isGroupsAreaFilter(filter: HomeActiveFilter): boolean {
  return filter === "groups";
}

/** True when Home renders a folder-tab panel (sub-filters) directly under the main tab row. */
export function homeHasSubFilterRowBelowTabs(
  filter: HomeActiveFilter
): boolean {
  return (
    isPublicAreaFilter(filter) ||
    filter === "personal" ||
    filter === "memorize" ||
    filter === "groups"
  );
}
