import type { ActivatedRoute, Params } from "@angular/router";
import type { Router } from "@angular/router";
import { resolvePrayerItemDeepLinkTab } from "../lib/prayer-item-deep-link";
import type { PrayerRequest } from "./prayer.service";
import type { PrayerService } from "./prayer.service";
import type { PromptService } from "./prompt.service";
import type { PersonalCategoryFilterMode } from "../types/presentation";
import type { PrayerFilters } from "../components/prayer-filters/prayer-filters.component";

export type HomeActiveFilter =
  | "current"
  | "answered"
  | "total"
  | "prompts"
  | "personal"
  | "memorize";

export interface HomeDeepLinkPageState {
  activeFilter: HomeActiveFilter;
  filters: PrayerFilters;
  selectedPromptTypes: string[];
  personalCategoryFilterMode: PersonalCategoryFilterMode;
  selectedPersonalCategories: string[];
}

export interface HomeDeepLinkHost {
  markForCheck(): void;
  getActiveFilter(): HomeActiveFilter;
  setFilter(filter: HomeActiveFilter): void;
  stripQueryParam(key: "filter" | "prayerId" | "promptId"): void;
  clearDeepLinkFilters(options?: { prayerId?: string }): void;
  resolvePrayerDeepLinkTab(prayerId: string): HomeActiveFilter | null;
  isMemberPrayerId(prayerId: string): boolean;
  isPrayerInLoadedCatalog(prayerId: string): boolean;
  shouldGiveUpMemberPrayerDeepLink(prayerId: string): boolean;
  shouldGiveUpCommunityPersonalPrayerDeepLink(prayerId: string): boolean;
  requestFreshPrayerCatalog(): void;
  isPromptInCatalog(promptId: string): boolean;
  arePromptsStillLoading(): boolean;
  requestFreshPromptCatalog(): void;
}

export interface HomeDeepLinkHostDependencies {
  page: HomeDeepLinkPageState;
  router: Router;
  route: ActivatedRoute;
  prayerService: PrayerService;
  promptService: PromptService;
  markForCheck: () => void;
  setFilter: (filter: HomeActiveFilter) => void;
  selectPersonalCategoryFilterMode: (
    mode: Exclude<PersonalCategoryFilterMode, "named">
  ) => void;
  applyPrayerFilters: (filters: {
    status?: PrayerFilters["status"];
    type?: PrayerFilters["type"];
    search?: string;
  }) => void;
  refreshHomeCatalog: () => void;
}

export class HomeDeepLinkHostAdapter implements HomeDeepLinkHost {
  constructor(private readonly deps: HomeDeepLinkHostDependencies) {}

  markForCheck(): void {
    this.deps.markForCheck();
  }

  getActiveFilter(): HomeActiveFilter {
    return this.deps.page.activeFilter;
  }

  setFilter(filter: HomeActiveFilter): void {
    this.deps.setFilter(filter);
  }

  stripQueryParam(key: "filter" | "prayerId" | "promptId"): void {
    const queryParams: Params = { [key]: null };
    void this.deps.router.navigate([], {
      relativeTo: this.deps.route,
      queryParams,
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  clearDeepLinkFilters(options?: { prayerId?: string }): void {
    this.deps.page.selectedPromptTypes = [];
    if (options?.prayerId) {
      const tab = this.resolvePrayerDeepLinkTab(options.prayerId);
      if (tab === "personal") {
        this.deps.selectPersonalCategoryFilterMode("total");
      }
    }
    this.deps.refreshHomeCatalog();
  }

  resolvePrayerDeepLinkTab(prayerId: string): HomeActiveFilter | null {
    const tab = resolvePrayerItemDeepLinkTab(
      prayerId,
      this.deps.prayerService.getAllCommunityPrayersSnapshot(),
      this.deps.prayerService.getPersonalPrayersSnapshot()
    );
    if (tab === "planning_center_list" || tab === "archived") {
      return "current";
    }
    return tab;
  }

  isMemberPrayerId(_prayerId: string): boolean {
    return false;
  }

  isPrayerInLoadedCatalog(prayerId: string): boolean {
    const community = this.deps.prayerService.getAllCommunityPrayersSnapshot();
    const personal = this.deps.prayerService.getPersonalPrayersSnapshot();
    return (
      community.some((p: PrayerRequest) => p.id === prayerId) ||
      personal.some((p: PrayerRequest) => p.id === prayerId)
    );
  }

  shouldGiveUpMemberPrayerDeepLink(_prayerId: string): boolean {
    return true;
  }

  shouldGiveUpCommunityPersonalPrayerDeepLink(prayerId: string): boolean {
    return !this.isPrayerInLoadedCatalog(prayerId);
  }

  requestFreshPrayerCatalog(): void {
    void this.deps.prayerService.loadPrayers(false);
    void this.deps.prayerService.loadPersonalPrayers(false);
  }

  isPromptInCatalog(promptId: string): boolean {
    return this.deps.promptService.getPromptsSnapshot().some((p) => p.id === promptId);
  }

  arePromptsStillLoading(): boolean {
    return false;
  }

  requestFreshPromptCatalog(): void {
    this.deps.promptService.loadPrompts();
  }
}
