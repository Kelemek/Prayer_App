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
  | "archived"
  | "total"
  | "prompts"
  | "personal"
  | "memorize"
  | "groups";

export type HomeDeepLinkQueryParamKey =
  | "filter"
  | "prayerId"
  | "promptId"
  | "verseRef"
  | "verseTranslation";

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
  stripQueryParam(key: HomeDeepLinkQueryParamKey): void;
  stripQueryParams(...keys: HomeDeepLinkQueryParamKey[]): void;
  clearDeepLinkFilters(options?: { prayerId?: string }): void;
  resolvePrayerDeepLinkTab(prayerId: string): HomeActiveFilter | null;
  isPrayerInLoadedCatalog(prayerId: string): boolean;
  shouldGiveUpCommunityPersonalPrayerDeepLink(prayerId: string): boolean;
  requestFreshPrayerCatalog(): void;
  isPromptInCatalog(promptId: string): boolean;
  arePromptsStillLoading(): boolean;
  requestFreshPromptCatalog(): void;
  applyPendingVerseMemorizationDeepLink(): void;
  /** Scroll the prompts virtual list toward `promptId` (returns false if not on Prompts). */
  scrollPromptIntoView(promptId: string): boolean;
  /** Scroll the Public community virtual list toward `prayerId` (returns false if not on a community tab). */
  scrollPrayerIntoView(prayerId: string): boolean;
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
  applyPendingVerseMemorizationDeepLink: () => void;
  scrollPromptIntoView: (promptId: string) => boolean;
  scrollPrayerIntoView: (prayerId: string) => boolean;
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

  stripQueryParam(key: HomeDeepLinkQueryParamKey): void {
    this.stripQueryParams(key);
  }

  stripQueryParams(...keys: HomeDeepLinkQueryParamKey[]): void {
    if (keys.length === 0) {
      return;
    }
    const q: Params = { ...(this.deps.route.snapshot?.queryParams ?? {}) };
    for (const key of keys) {
      delete q[key];
    }
    void this.deps.router.navigate([], {
      relativeTo: this.deps.route,
      queryParams: q,
      queryParamsHandling: "",
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
    return tab;
  }

  isPrayerInLoadedCatalog(prayerId: string): boolean {
    const community = this.deps.prayerService.getAllCommunityPrayersSnapshot();
    const personal = this.deps.prayerService.getPersonalPrayersSnapshot();
    return (
      community.some((p: PrayerRequest) => p.id === prayerId) ||
      personal.some((p: PrayerRequest) => p.id === prayerId)
    );
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
    return this.deps.promptService.isPromptsLoading();
  }

  requestFreshPromptCatalog(): void {
    this.deps.promptService.loadPrompts();
  }

  applyPendingVerseMemorizationDeepLink(): void {
    this.deps.applyPendingVerseMemorizationDeepLink();
  }

  scrollPromptIntoView(promptId: string): boolean {
    return this.deps.scrollPromptIntoView(promptId);
  }

  scrollPrayerIntoView(prayerId: string): boolean {
    return this.deps.scrollPrayerIntoView(prayerId);
  }
}
