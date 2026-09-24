import { describe, it, expect, vi, beforeEach } from "vitest";
import { HomeDeepLinkHostAdapter } from "./home-deep-link-host.adapter";
import type { HomeDeepLinkPageState } from "./home-deep-link-host.adapter";

describe("HomeDeepLinkHostAdapter", () => {
  let page: HomeDeepLinkPageState;
  let applyPrayerFilters: ReturnType<typeof vi.fn>;
  let refreshHomeCatalog: ReturnType<typeof vi.fn>;
  let adapter: HomeDeepLinkHostAdapter;

  beforeEach(() => {
    page = {
      activeFilter: "personal",
      filters: { status: "current", searchTerm: "grace" },
      selectedPromptTypes: ["Morning"],
      personalCategoryFilterMode: "named",
      selectedPersonalCategories: ["Health"],
    };
    applyPrayerFilters = vi.fn();
    refreshHomeCatalog = vi.fn();
    adapter = new HomeDeepLinkHostAdapter({
      page,
      router: { navigate: vi.fn() } as any,
      route: { snapshot: { queryParams: {} } } as any,
      prayerService: {
        getAllCommunityPrayersSnapshot: vi.fn(() => []),
        getPersonalPrayersSnapshot: vi.fn(() => []),
        arePrayerCatalogsReady: vi.fn(() => true),
        loadPrayers: vi.fn(),
        loadPersonalPrayers: vi.fn(),
      } as any,
      promptService: {
        getPromptsSnapshot: vi.fn(() => [{ id: 'prompt-1' }]),
        isPromptsLoading: vi.fn(() => false),
        loadPrompts: vi.fn(),
      } as any,
      applyPendingVerseMemorizationDeepLink: vi.fn(),
      scrollPromptIntoView: vi.fn(() => true),
      scrollPrayerIntoView: vi.fn(() => true),
      markForCheck: vi.fn(),
      setFilter: vi.fn(),
      selectPersonalCategoryFilterMode: vi.fn((mode) => {
        page.personalCategoryFilterMode = mode;
        page.selectedPersonalCategories = [];
      }),
      applyPrayerFilters,
      refreshHomeCatalog,
    });
  });

  it("clearDeepLinkFilters rebuilds catalog after clearing chips", () => {
    adapter.clearDeepLinkFilters();

    expect(page.selectedPromptTypes).toEqual([]);
    expect(refreshHomeCatalog).toHaveBeenCalled();
  });

  it("clearDeepLinkFilters still refreshes when chips are already clear", () => {
    page.filters = { status: "current" };
    page.selectedPromptTypes = [];
    page.personalCategoryFilterMode = "current";
    page.selectedPersonalCategories = [];

    adapter.clearDeepLinkFilters();

    expect(refreshHomeCatalog).toHaveBeenCalled();
  });

  it('stripQueryParams navigates without removed keys', () => {
    const navigate = vi.fn();
    adapter = new HomeDeepLinkHostAdapter({
      page,
      router: { navigate } as any,
      route: { snapshot: { queryParams: { filter: 'current', prayerId: 'p1' } } } as any,
      prayerService: {
        getAllCommunityPrayersSnapshot: vi.fn(() => [{ id: 'p1' }]),
        getPersonalPrayersSnapshot: vi.fn(() => []),
        loadPrayers: vi.fn(),
        loadPersonalPrayers: vi.fn(),
      } as any,
      promptService: {
        getPromptsSnapshot: vi.fn(() => []),
        isPromptsLoading: vi.fn(() => false),
        loadPrompts: vi.fn(),
      } as any,
      markForCheck: vi.fn(),
      setFilter: vi.fn(),
      selectPersonalCategoryFilterMode: vi.fn(),
      applyPrayerFilters,
      refreshHomeCatalog,
      applyPendingVerseMemorizationDeepLink: vi.fn(),
      scrollPromptIntoView: vi.fn(),
      scrollPrayerIntoView: vi.fn(),
    });
    adapter.stripQueryParams('prayerId');
    expect(navigate).toHaveBeenCalled();
  });

  it('resolvePrayerDeepLinkTab and catalog helpers', () => {
    expect(adapter.getActiveFilter()).toBe('personal');
    adapter.setFilter('current');
    expect(adapter.resolvePrayerDeepLinkTab('missing')).toBeNull();
    expect(adapter.isPrayerInLoadedCatalog('missing')).toBe(false);
    expect(adapter.shouldGiveUpCommunityPersonalPrayerDeepLink('missing')).toBe(true);
    expect(adapter.isPromptInCatalog('prompt-1')).toBe(true);
    expect(adapter.arePromptsStillLoading()).toBe(false);
    adapter.requestFreshPrayerCatalog();
    adapter.requestFreshPromptCatalog();
    adapter.applyPendingVerseMemorizationDeepLink();
    expect(adapter.scrollPromptIntoView('prompt-1')).toBe(true);
    expect(adapter.scrollPrayerIntoView('p1')).toBe(true);
    adapter.markForCheck();
  });

  it('clearDeepLinkFilters switches personal tab to total when prayer is personal', () => {
    const prayerService = {
      getAllCommunityPrayersSnapshot: vi.fn(() => []),
      getPersonalPrayersSnapshot: vi.fn(() => [{ id: 'pp1' }]),
      loadPrayers: vi.fn(),
      loadPersonalPrayers: vi.fn(),
    };
    adapter = new HomeDeepLinkHostAdapter({
      page,
      router: { navigate: vi.fn() } as any,
      route: { snapshot: { queryParams: {} } } as any,
      prayerService: prayerService as any,
      promptService: {
        getPromptsSnapshot: vi.fn(() => []),
        isPromptsLoading: vi.fn(() => false),
        loadPrompts: vi.fn(),
      } as any,
      markForCheck: vi.fn(),
      setFilter: vi.fn(),
      selectPersonalCategoryFilterMode: vi.fn((mode) => {
        page.personalCategoryFilterMode = mode;
      }),
      applyPrayerFilters,
      refreshHomeCatalog,
      applyPendingVerseMemorizationDeepLink: vi.fn(),
      scrollPromptIntoView: vi.fn(),
      scrollPrayerIntoView: vi.fn(),
    });
    adapter.clearDeepLinkFilters({ prayerId: 'pp1' });
    expect(page.personalCategoryFilterMode).toBe('total');
  });

  it('stripQueryParam is an alias for stripQueryParams', () => {
    const navigate = vi.fn();
    adapter = new HomeDeepLinkHostAdapter({
      page,
      router: { navigate } as any,
      route: { snapshot: { queryParams: { filter: 'current' } } } as any,
      prayerService: {
        getAllCommunityPrayersSnapshot: vi.fn(() => []),
        getPersonalPrayersSnapshot: vi.fn(() => []),
        loadPrayers: vi.fn(),
        loadPersonalPrayers: vi.fn(),
      } as any,
      promptService: {
        getPromptsSnapshot: vi.fn(() => []),
        isPromptsLoading: vi.fn(() => false),
        loadPrompts: vi.fn(),
      } as any,
      markForCheck: vi.fn(),
      setFilter: vi.fn(),
      selectPersonalCategoryFilterMode: vi.fn(),
      applyPrayerFilters,
      refreshHomeCatalog,
      applyPendingVerseMemorizationDeepLink: vi.fn(),
      scrollPromptIntoView: vi.fn(),
      scrollPrayerIntoView: vi.fn(),
    });
    adapter.stripQueryParam('filter');
    expect(navigate).toHaveBeenCalled();
    adapter.stripQueryParams();
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
