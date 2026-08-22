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
        promptsSubject: { value: [] },
        isPromptsLoading: vi.fn(() => false),
        loadPrompts: vi.fn(),
      } as any,
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
});
