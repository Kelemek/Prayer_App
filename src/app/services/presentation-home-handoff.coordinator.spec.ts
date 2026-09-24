import { describe, it, expect, vi } from "vitest";
import { PresentationHomeHandoffCoordinator } from "./presentation-home-handoff.coordinator";
import {
  HOME_RETURN_CONTEXT_STATE_KEY,
  PRESENTATION_HOME_HANDOFF_STATE_KEY,
  buildPresentationHomeHandoff,
} from "../types/presentation";

describe("PresentationHomeHandoffCoordinator", () => {
  const coordinator = new PresentationHomeHandoffCoordinator();

  it("applies handoff filters and return context to page state", () => {
    const page = {
      contentTypes: ["prayers"] as const,
      statusFilters: { current: true, answered: true, archived: false },
      selectedPromptCategories: [] as string[],
      selectedPersonalCategories: [] as string[],
      homeReturnContext: null,
    };

    coordinator.applyHandoff(page, {
      contentTypes: ["personal"],
      statusFilters: { current: false, answered: true, archived: false },
      promptCategories: ["encouragement"],
      personalCategories: ["Family"],
      returnContext: {
        activeFilter: "personal",
        selectedPersonalCategories: ["Family"],
        personalCategoryFilterMode: "named",
      },
    });

    expect(page.contentTypes).toEqual(["personal"]);
    expect(page.statusFilters).toEqual({ current: false, answered: true, archived: false });
    expect(page.selectedPromptCategories).toEqual(["encouragement"]);
    expect(page.selectedPersonalCategories).toEqual(["Family"]);
    expect(page.homeReturnContext).toEqual({
      activeFilter: "personal",
      selectedPersonalCategories: ["Family"],
      personalCategoryFilterMode: "named",
    });
  });

  it("consumes one-shot history state handoff", () => {
    const handoff = buildPresentationHomeHandoff({
      contentTypes: ["prayers"],
      activeFilter: "community",
    });
    const replaceHistoryState = vi.fn();

    const consumed = coordinator.consumeFromNavigation({
      historyState: { [PRESENTATION_HOME_HANDOFF_STATE_KEY]: handoff },
      replaceHistoryState,
      getQueryParam: () => null,
      clearQueryParams: vi.fn(),
    });

    expect(consumed?.contentTypes).toEqual(["prayers"]);
    expect(replaceHistoryState).toHaveBeenCalled();
  });

  it("navigates home with return context when exiting presentation", () => {
    const router = { navigate: vi.fn() };
    const returnContext = {
      activeFilter: "personal" as const,
      selectedPersonalCategories: ["Evening"],
    };

    coordinator.navigateExit(router as any, returnContext);

    expect(router.navigate).toHaveBeenCalledWith(["/"], {
      state: { [HOME_RETURN_CONTEXT_STATE_KEY]: returnContext },
    });
  });

  it("builds home handoff from active filter and category state", () => {
    const handoff = coordinator.buildHandoffFromHome({
      activeFilter: "personal",
      selectedPromptTypes: [],
      selectedPersonalCategories: ["Family"],
      personalCategoryFilterMode: "named",
      defaultPrayerView: "current",
    });

    expect(handoff.contentTypes).toEqual(["personal"]);
    expect(handoff.personalCategories).toEqual(["Family"]);
    expect(handoff.returnContext).toEqual({
      activeFilter: "personal",
      selectedPersonalCategories: ["Family"],
    });
  });

  it("consumes one-shot home return context from history state", () => {
    const replaceHistoryState = vi.fn();
    const consumed = coordinator.consumeHomeReturnContext({
      historyState: {
        [HOME_RETURN_CONTEXT_STATE_KEY]: {
          activeFilter: "prompts",
          selectedPromptTypes: ["Morning"],
        },
      },
      replaceHistoryState,
    });

    expect(consumed).toEqual({
      activeFilter: "prompts",
      selectedPromptTypes: ["Morning"],
    });
    expect(replaceHistoryState).toHaveBeenCalled();
  });

  it("applies home return context through host adapter hooks", () => {
    const host = {
      setFilter: vi.fn(),
      setSelectedPromptTypes: vi.fn(),
      applyPersonalReturnContext: vi.fn(),
      onReturnContextApplied: vi.fn(),
    };

    coordinator.applyHomeReturnContext(host, {
      activeFilter: "personal",
      personalCategoryFilterMode: "named",
      selectedPersonalCategories: ["Family"],
    });

    expect(host.setFilter).toHaveBeenCalledWith("personal");
    expect(host.applyPersonalReturnContext).toHaveBeenCalledWith({
      personalCategoryFilterMode: "named",
      selectedPersonalCategories: ["Family"],
    });
    expect(host.onReturnContextApplied).toHaveBeenCalled();
  });

  it("defers presentation navigation for modifier clicks", () => {
    expect(
      coordinator.shouldUseNativePresentationNavigation({
        button: 0,
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      } as MouseEvent)
    ).toBe(true);
  });

  it("navigates to presentation with handoff state", () => {
    const router = { navigate: vi.fn() };
    const handoff = buildPresentationHomeHandoff({
      contentTypes: ["prompts"],
      activeFilter: "prompts",
    });
    coordinator.navigateToPresentation(router as never, handoff);
    expect(router.navigate).toHaveBeenCalledWith(["/presentation"], {
      state: { [PRESENTATION_HOME_HANDOFF_STATE_KEY]: handoff },
    });
  });

  it("serializes query params for shareable presentation links", () => {
    const handoff = buildPresentationHomeHandoff({
      contentTypes: ["prayers"],
      activeFilter: "community",
    });
    const params = coordinator.getQueryParamsForLink(handoff);
    expect(params).not.toBeNull();
  });

  it("consumes handoff from query params when history state is absent", () => {
    const handoff = buildPresentationHomeHandoff({
      contentTypes: ["personal"],
      activeFilter: "personal",
    });
    const queryParams = coordinator.getQueryParamsForLink(handoff)!;
    const clearQueryParams = vi.fn();
    const consumed = coordinator.consumeFromNavigation({
      historyState: null,
      replaceHistoryState: vi.fn(),
      getQueryParam: (key) => queryParams[key] ?? null,
      clearQueryParams,
    });
    expect(consumed?.contentTypes).toEqual(["personal"]);
    expect(clearQueryParams).toHaveBeenCalled();
  });

  it("consumeAndApply merges handoff into page state", () => {
    const page = {
      contentTypes: ["prayers"] as const,
      statusFilters: { current: true, answered: true, archived: false },
      selectedPromptCategories: [] as string[],
      selectedPersonalCategories: [] as string[],
      homeReturnContext: null,
    };
    const handoff = buildPresentationHomeHandoff({
      contentTypes: ["prompts"],
      activeFilter: "prompts",
    });
    const consumed = coordinator.consumeAndApply(page, {
      historyState: { [PRESENTATION_HOME_HANDOFF_STATE_KEY]: handoff },
      replaceHistoryState: vi.fn(),
      getQueryParam: () => null,
      clearQueryParams: vi.fn(),
    });
    expect(consumed?.contentTypes).toEqual(["prompts"]);
    expect(page.contentTypes).toEqual(["prompts"]);
  });

  it("navigates home without state when return context is missing", () => {
    const router = { navigate: vi.fn() };
    coordinator.navigateExit(router as never, null);
    expect(router.navigate).toHaveBeenCalledWith(["/"]);
  });

  it("returns null query params when handoff has no serializable fields", () => {
    expect(coordinator.getQueryParamsForLink({ contentTypes: [] })).toBeNull();
  });

  it("builds handoff using default prayer view when unset", () => {
    const handoff = coordinator.buildHandoffFromHome({
      activeFilter: "current",
      selectedPromptTypes: [],
      selectedPersonalCategories: [],
      personalCategoryFilterMode: "all",
      defaultPrayerView: undefined,
    });
    expect(handoff.contentTypes.length).toBeGreaterThan(0);
  });

  it("consumeHomeReturnContext returns null when state is empty", () => {
    expect(
      coordinator.consumeHomeReturnContext({
        historyState: {},
        replaceHistoryState: vi.fn(),
      })
    ).toBeNull();
  });

  it("allows unmodified left click navigation", () => {
    expect(
      coordinator.shouldUseNativePresentationNavigation({
        button: 0,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      } as MouseEvent)
    ).toBe(false);
  });

  it("applies prompt types from home return context", () => {
    const host = {
      setFilter: vi.fn(),
      setSelectedPromptTypes: vi.fn(),
      applyPersonalReturnContext: vi.fn(),
      onReturnContextApplied: vi.fn(),
    };
    coordinator.applyHomeReturnContext(host, {
      activeFilter: "prompts",
      selectedPromptTypes: ["Morning"],
    });
    expect(host.setSelectedPromptTypes).toHaveBeenCalledWith(["Morning"]);
  });
});
