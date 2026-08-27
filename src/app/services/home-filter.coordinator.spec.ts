import { describe, it, expect, vi, beforeEach } from "vitest";
import { HomeFilterCoordinator } from "./home-filter.coordinator";
import type { HomeFilterHost } from "./home-filter.coordinator";

describe("HomeFilterCoordinator", () => {
  let coordinator: HomeFilterCoordinator;
  let host: HomeFilterHost;

  beforeEach(() => {
    coordinator = new HomeFilterCoordinator();
    let pageState = {
      activeFilter: "current" as const,
      filters: { status: "current" as const, searchTerm: "find" },
      selectedPromptTypes: ["Morning"],
    };
    host = {
      getPageState: vi.fn(() => pageState),
      setActiveFilter: vi.fn((filter) => {
        pageState = { ...pageState, activeFilter: filter };
      }),
      setFilters: vi.fn((filters) => {
        pageState = { ...pageState, filters };
      }),
      clearSelectedPromptTypes: vi.fn(() => {
        pageState = { ...pageState, selectedPromptTypes: [] };
      }),
      setSelectedPromptTypes: vi.fn((types: string[]) => {
        pageState = { ...pageState, selectedPromptTypes: types };
      }),
      getPrompts: vi.fn(() => []),
      isPromptUnread: vi.fn(() => false),
      applyPrayerFilters: vi.fn(),
      loadMemorizationItems: vi.fn(),
      canAccessShared: vi.fn(() => true),
      onFilterChanged: vi.fn(),
    };
    coordinator.bindHost(host);
  });

  it("applies search-only filter changes", () => {
    coordinator.onFiltersChange({ searchTerm: "grace" });

    expect(host.setFilters).toHaveBeenCalledWith({
      status: "current",
      searchTerm: "grace",
    });
    expect(host.applyPrayerFilters).toHaveBeenCalledWith({
      status: "current",
      search: "grace",
    });
    expect(host.onFilterChanged).toHaveBeenCalled();
  });

  it("switches to prompts and clears prayer results", () => {
    coordinator.setFilter("prompts");

    expect(host.setActiveFilter).toHaveBeenCalledWith("prompts");
    expect(host.clearSelectedPromptTypes).toHaveBeenCalled();
    expect(host.applyPrayerFilters).toHaveBeenCalledWith({ search: "" });
    expect(host.onFilterChanged).toHaveBeenCalled();
  });

  it("loads memorization items when memorize tab is selected", () => {
    coordinator.setFilter("memorize");

    expect(host.loadMemorizationItems).toHaveBeenCalled();
    expect(host.applyPrayerFilters).toHaveBeenCalledWith({ search: "" });
  });

  it("toggles prompt type chips and clears when re-selected", () => {
    coordinator.togglePromptType("Morning");
    expect(host.setSelectedPromptTypes).toHaveBeenCalledWith([]);

    coordinator.togglePromptType("Morning");
    expect(host.setSelectedPromptTypes).toHaveBeenLastCalledWith(["Morning"]);
  });

  it("clears selected prompt types via clearSelectedPromptTypes", () => {
    coordinator.clearSelectedPromptTypes();

    expect(host.setSelectedPromptTypes).toHaveBeenCalledWith([]);
    expect(host.onFilterChanged).toHaveBeenCalled();
  });

  it("selectPublicTab switches to current when leaving another tab", () => {
    host.getPageState = vi.fn(() => ({
      activeFilter: "prompts" as const,
      filters: { status: "current" as const, searchTerm: "" },
      selectedPromptTypes: [],
    }));

    coordinator.selectPublicTab();

    expect(host.setActiveFilter).toHaveBeenCalledWith("current");
  });

  it("selectPublicTab preserves answered when already on public", () => {
    host.getPageState = vi.fn(() => ({
      activeFilter: "answered" as const,
      filters: { status: "answered" as const, searchTerm: "" },
      selectedPromptTypes: [],
    }));

    coordinator.selectPublicTab();

    expect(host.setActiveFilter).not.toHaveBeenCalled();
  });

  it("selectPublicTab preserves archived when already on public", () => {
    host.getPageState = vi.fn(() => ({
      activeFilter: "archived" as const,
      filters: { status: "archived" as const, searchTerm: "" },
      selectedPromptTypes: [],
    }));

    coordinator.selectPublicTab();

    expect(host.setActiveFilter).not.toHaveBeenCalled();
  });

  it("applies archived status filters", () => {
    coordinator.setFilter("archived");

    expect(host.setActiveFilter).toHaveBeenCalledWith("archived");
    expect(host.setFilters).toHaveBeenCalledWith({
      status: "archived",
      searchTerm: "find",
    });
    expect(host.applyPrayerFilters).toHaveBeenCalledWith({
      status: "archived",
      search: "find",
    });
  });

  it("resets the home scroll viewport when switching filters", () => {
    const shell = document.createElement("div");
    shell.className = "main-page-shell";
    const viewport = document.createElement("div");
    viewport.className = "safe-area-viewport";
    viewport.scrollTop = 320;
    shell.appendChild(viewport);
    document.body.appendChild(shell);

    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      });

    coordinator.setFilter("answered");

    expect(viewport.scrollTop).toBe(0);
    expect(rafSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
    document.body.innerHTML = "";
  });

  it("getUnreadPromptCountByType counts only unread prompts of that type", () => {
    host.getPrompts = vi.fn(() => [
      {
        id: "1",
        type: "Morning",
        title: "a",
        description: "a",
        created_at: "",
        updated_at: "",
      },
      {
        id: "2",
        type: "Morning",
        title: "b",
        description: "b",
        created_at: "",
        updated_at: "",
      },
      {
        id: "3",
        type: "Evening",
        title: "c",
        description: "c",
        created_at: "",
        updated_at: "",
      },
    ]);
    host.isPromptUnread = vi.fn((id: string) => id === "1" || id === "3");

    expect(coordinator.getUnreadPromptCountByType("Morning")).toBe(1);
    expect(coordinator.getUnreadPromptCountByType("Evening")).toBe(1);
    expect(coordinator.getUnreadPromptCountByType("Night")).toBe(0);
  });
});
