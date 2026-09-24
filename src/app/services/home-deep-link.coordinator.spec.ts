import { describe, it, expect, vi, beforeEach } from "vitest";
import { HomeDeepLinkCoordinator } from "./home-deep-link.coordinator";
import type { HomeDeepLinkHost } from "./home-deep-link-host.adapter";

describe("HomeDeepLinkCoordinator", () => {
  let coordinator: HomeDeepLinkCoordinator;
  let host: HomeDeepLinkHost;

  beforeEach(() => {
    coordinator = new HomeDeepLinkCoordinator();
    host = {
      markForCheck: vi.fn(),
      getActiveFilter: vi.fn(() => "current"),
      setFilter: vi.fn(),
      stripQueryParam: vi.fn(),
      clearDeepLinkFilters: vi.fn(),
      resolvePrayerDeepLinkTab: vi.fn(() => "personal"),
      isPrayerInLoadedCatalog: vi.fn(() => true),
      shouldGiveUpCommunityPersonalPrayerDeepLink: vi.fn(() => false),
      requestFreshPrayerCatalog: vi.fn(),
      isPromptInCatalog: vi.fn(() => true),
      arePromptsStillLoading: vi.fn(() => false),
      requestFreshPromptCatalog: vi.fn(),
      applyPendingVerseMemorizationDeepLink: vi.fn(),
      stripQueryParams: vi.fn(),
      scrollPromptIntoView: vi.fn(() => false),
      scrollPrayerIntoView: vi.fn(() => false),
    };
    coordinator.bindHost(host);
  });

  it("captures initial email filter and deep-link ids", () => {
    coordinator.captureInitialQueryParams({
      filter: "memorize",
      prayerId: " prayer-1 ",
      promptId: "prompt-1",
    });

    expect(coordinator.initialEmailFilterTab).toBe("memorize");
    expect(coordinator.consumeInitialEmailFilterTab()).toBe("memorize");
  });

  it("ignores archived email filter tab", () => {
    coordinator.captureInitialQueryParams({
      filter: "archived",
    });

    expect(coordinator.consumeInitialEmailFilterTab()).toBeNull();
  });

  it("defers deep links until view is ready", () => {
    coordinator.handleNavigationDeepLinks(
      { filter: null, prayerId: "p1", promptId: null },
      false
    );

    expect(host.setFilter).not.toHaveBeenCalled();
    expect(host.stripQueryParam).not.toHaveBeenCalled();
  });

  it("opens prayer deep links when view is ready", () => {
    const scrollSpy = vi
      .spyOn(document, "getElementById")
      .mockReturnValue({ scrollIntoView: vi.fn() } as unknown as HTMLElement);

    coordinator.handleNavigationDeepLinks(
      { filter: null, prayerId: "p1", promptId: null },
      true
    );

    expect(host.clearDeepLinkFilters).toHaveBeenCalledWith({ prayerId: "p1" });
    expect(host.setFilter).toHaveBeenCalledWith("personal");
    expect(host.stripQueryParam).toHaveBeenCalledWith("prayerId");
    scrollSpy.mockRestore();
  });

  it("switches to prompts for prompt deep links", () => {
    const scrollSpy = vi
      .spyOn(document, "getElementById")
      .mockReturnValue({ scrollIntoView: vi.fn() } as unknown as HTMLElement);

    coordinator.openPromptDeepLink("prompt-1");

    expect(host.requestFreshPromptCatalog).toHaveBeenCalled();
    expect(host.clearDeepLinkFilters).toHaveBeenCalled();
    expect(host.setFilter).toHaveBeenCalledWith("prompts");
    scrollSpy.mockRestore();
  });

  it("gives up unresolved prompt deep links when catalog finished loading", () => {
    vi.mocked(host.isPromptInCatalog).mockReturnValue(false);
    vi.mocked(host.arePromptsStillLoading).mockReturnValue(false);

    coordinator.captureInitialQueryParams({ promptId: "missing" });
    coordinator.retryPendingPromptDeepLinkIfNeeded();

    expect(host.setFilter).not.toHaveBeenCalled();
  });

  it("captures verse memorization params and consumes them once", () => {
    coordinator.captureInitialQueryParams({
      verseRef: " John 3:16 ",
      verseTranslation: " esv ",
    });
    expect(coordinator.hasPendingVerseMemorization()).toBe(true);
    expect(coordinator.consumePendingVerseMemorization()).toEqual({
      reference: "John 3:16",
      translation: "esv",
    });
    expect(coordinator.consumePendingVerseMemorization()).toBeNull();
  });

  it("applies memorize filter when verse deep link is pending", () => {
    coordinator.captureInitialQueryParams({ verseRef: "Romans 8:28" });
    coordinator.handleNavigationDeepLinks(
      { filter: null, prayerId: null, promptId: null, verseRef: "Romans 8:28" },
      true
    );
    expect(host.setFilter).toHaveBeenCalledWith("memorize");
    expect(host.applyPendingVerseMemorizationDeepLink).toHaveBeenCalled();
  });

  it("retries prayer deep links and schedules scroll", () => {
    vi.mocked(host.getActiveFilter).mockReturnValue("current");
    coordinator.captureInitialQueryParams({ prayerId: "p-retry" });
    host.scrollPrayerIntoView = vi.fn(() => true);
    coordinator.retryPendingPrayerDeepLinkIfNeeded();
    expect(host.requestFreshPrayerCatalog).toHaveBeenCalled();
    expect(host.setFilter).toHaveBeenCalledWith("personal");
  });

  it("scrolls to prayer card when element exists", () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    vi.spyOn(document, "getElementById").mockReturnValue({
      scrollIntoView,
    } as unknown as HTMLElement);
    host.scrollPrayerIntoView = vi.fn(() => true);

    coordinator.openPrayerDeepLink("p-scroll");
    vi.runAllTimers();

    expect(scrollIntoView).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("handleNavigationDeepLinks applies email filter when view is ready", () => {
    coordinator.handleNavigationDeepLinks(
      { filter: "answered", prayerId: null, promptId: null },
      true
    );
    expect(host.setFilter).toHaveBeenCalledWith("answered");
    expect(host.stripQueryParam).toHaveBeenCalledWith("filter");
  });

  it("no-ops deep link helpers when host is not bound", () => {
    const bare = new HomeDeepLinkCoordinator();
    bare.openPrayerDeepLink("p1");
    bare.openPromptDeepLink("pr1");
    bare.retryPendingPrayerDeepLinkIfNeeded();
    bare.retryPendingPromptDeepLinkIfNeeded();
    expect(host.setFilter).not.toHaveBeenCalled();
  });

  it("retries prompt deep link when prompt exists in catalog", () => {
    coordinator.captureInitialQueryParams({ promptId: "pr-retry" });
    coordinator.retryPendingPromptDeepLinkIfNeeded();
    expect(host.setFilter).toHaveBeenCalledWith("prompts");
    expect(host.requestFreshPromptCatalog).toHaveBeenCalled();
  });

  it("gives up unresolved prayer deep links when catalog cannot resolve id", () => {
    vi.mocked(host.shouldGiveUpCommunityPersonalPrayerDeepLink).mockReturnValue(true);
    coordinator.captureInitialQueryParams({ prayerId: "missing" });
    coordinator.retryPendingPrayerDeepLinkIfNeeded();
    expect(host.setFilter).not.toHaveBeenCalled();
  });

  it("stores email filter while view is not ready", () => {
    coordinator.handleNavigationDeepLinks(
      { filter: "memorize", prayerId: null, promptId: null },
      false
    );
    expect(coordinator.consumeInitialEmailFilterTab()).toBe("memorize");
  });

  it("applyPendingDeepLinksOnViewReady opens captured ids", () => {
    coordinator.captureInitialQueryParams({ prayerId: "p1", promptId: "pr1" });
    coordinator.applyPendingDeepLinksOnViewReady();
    expect(host.setFilter).toHaveBeenCalled();
    expect(host.stripQueryParam).toHaveBeenCalled();
  });
});
