import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HomePersonalCategoryController } from "./home-personal-category.controller";
import type { PrayerRequest } from "./prayer.service";
import { HOME_PERSONAL_CATEGORY_DRAG_SCROLL_LOCK_CLASS } from "../lib/personal-category-drag-scroll";

function categoriesWithOrder(
  entries: Array<{ id: string; name: string; display_order: number }>
) {
  return entries.map((entry) => ({
    ...entry,
    color: null,
  }));
}

describe("HomePersonalCategoryController", () => {
  let controller: HomePersonalCategoryController;
  let host: {
    getPersonalPrayers: ReturnType<typeof vi.fn>;
    markForCheck: ReturnType<typeof vi.fn>;
    detectChanges: ReturnType<typeof vi.fn>;
    onFilterStateChanged: ReturnType<typeof vi.fn>;
  };
  let prayerService: {
    reorderCategories: ReturnType<typeof vi.fn>;
    getPersonalPrayersSnapshot: ReturnType<typeof vi.fn>;
    getPersonalCategoriesSnapshot: ReturnType<typeof vi.fn>;
    renamePersonalCategory: ReturnType<typeof vi.fn>;
    deletePersonalCategory: ReturnType<typeof vi.fn>;
    updatePersonalPrayerOrder: ReturnType<typeof vi.fn>;
  };
  let personalCategoryColorService: {
    getColorsSnapshot: ReturnType<typeof vi.fn>;
    renameCategory: ReturnType<typeof vi.fn>;
    deleteCategory: ReturnType<typeof vi.fn>;
  };
  let toastService: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    controller = new HomePersonalCategoryController();
    host = {
      getPersonalPrayers: vi.fn(() => []),
      setPersonalPrayers: vi.fn(),
      getFilteredPersonalPrayers: vi.fn(() => []),
      setIsReorderingPersonalPrayers: vi.fn(),
      markForCheck: vi.fn(),
      detectChanges: vi.fn(),
      onFilterStateChanged: vi.fn(),
    };
    prayerService = {
      reorderCategories: vi.fn(),
      getPersonalPrayersSnapshot: vi.fn(() => []),
      getPersonalCategoriesSnapshot: vi.fn(() => []),
      renamePersonalCategory: vi.fn(),
      deletePersonalCategory: vi.fn(),
      updatePersonalPrayerOrder: vi.fn(),
    };
    personalCategoryColorService = {
      getColorsSnapshot: vi.fn(() => ({})),
      renameCategory: vi.fn(),
      deleteCategory: vi.fn().mockResolvedValue(true),
    };
    toastService = { error: vi.fn(), success: vi.fn() };
    controller.bindHost(host, {
      prayerService: prayerService as any,
      personalCategoryColorService: personalCategoryColorService as any,
      toastService: toastService as any,
    });
  });

  it("togglePersonalCategory clears selection when already chosen", () => {
    controller.personalCategoryFilterMode = "named";
    controller.selectedPersonalCategories = ["Members"];
    controller.togglePersonalCategory("Members");
    expect(controller.selectedPersonalCategories).toEqual([]);
    expect(controller.personalCategoryFilterMode).toBe("total");
    expect(host.onFilterStateChanged).toHaveBeenCalled();
  });

  it("selectPersonalCategoryFilterMode switches fixed chips and clears named selection", () => {
    controller.personalCategoryFilterMode = "named";
    controller.selectedPersonalCategories = ["Health"];
    controller.selectPersonalCategoryFilterMode("answered");
    expect(controller.personalCategoryFilterMode).toBe("answered");
    expect(controller.selectedPersonalCategories).toEqual([]);
    controller.selectPersonalCategoryFilterMode("total");
    expect(controller.personalCategoryFilterMode).toBe("total");
  });

  it("derives named categories from the category snapshot excluding Answered", () => {
    prayerService.getPersonalCategoriesSnapshot.mockReturnValue(
      categoriesWithOrder([
        { id: "c1", name: "Health", display_order: 0 },
        { id: "c2", name: "Answered", display_order: 1 },
        { id: "c3", name: "Family", display_order: 2 },
      ])
    );
    expect(controller.uniquePersonalCategories).toEqual(["Health", "Family"]);
  });

  it("falls back to prayer category names when the snapshot is empty", () => {
    prayerService.getPersonalCategoriesSnapshot.mockReturnValue([]);
    host.getPersonalPrayers.mockReturnValue([
      { id: "a", category: "test2" } as PrayerRequest,
      { id: "b", category: "test" } as PrayerRequest,
      { id: "c", category: "test" } as PrayerRequest,
    ]);
    expect(controller.uniquePersonalCategories).toEqual(["test2", "test"]);
  });

  it("onCategoryDrop reorders by category id", async () => {
    prayerService.getPersonalCategoriesSnapshot.mockReturnValue(
      categoriesWithOrder([
        { id: "c-members", name: "Members", display_order: 0 },
        { id: "c-leaders", name: "Leaders", display_order: 1 },
      ])
    );
    prayerService.reorderCategories.mockResolvedValue(true);

    await controller.onCategoryDrop({
      previousIndex: 0,
      currentIndex: 1,
    } as any);

    expect(prayerService.reorderCategories).toHaveBeenCalledWith([
      "c-leaders",
      "c-members",
    ]);
    expect(controller.isCategoryDropListDisabled).toBe(false);
  });

  it("onCategoryDrop rolls back optimistic order when reorder fails", async () => {
    prayerService.getPersonalCategoriesSnapshot.mockReturnValue(
      categoriesWithOrder([
        { id: "c-members", name: "Members", display_order: 0 },
        { id: "c-leaders", name: "Leaders", display_order: 1 },
      ])
    );
    prayerService.reorderCategories.mockResolvedValue(false);

    await controller.onCategoryDrop({
      previousIndex: 0,
      currentIndex: 1,
    } as any);

    expect(toastService.error).toHaveBeenCalledWith(
      "Failed to reorder categories"
    );
    expect(controller.uniquePersonalCategories).toEqual(["Members", "Leaders"]);
  });

  it("syncCategoriesFromPrayers clears pending optimistic order", async () => {
    prayerService.getPersonalCategoriesSnapshot.mockReturnValue(
      categoriesWithOrder([{ id: "c1", name: "Health", display_order: 0 }])
    );
    await controller.syncCategoriesFromPrayers([]);
    expect(controller.uniquePersonalCategories).toEqual(["Health"]);
    expect(host.markForCheck).toHaveBeenCalled();
  });

  it("onPersonalPrayerDrop refreshes catalog after optimistic reorder", async () => {
    controller.personalCategoryFilterMode = "named";
    controller.selectedPersonalCategories = ["Health"];
    const prayers = [
      { id: "a", category: "Health" } as PrayerRequest,
      { id: "b", category: "Health" } as PrayerRequest,
    ];
    host.getPersonalPrayers.mockReturnValue(prayers);
    host.getFilteredPersonalPrayers.mockReturnValue([...prayers]);
    prayerService.updatePersonalPrayerOrder.mockResolvedValue(true);

    await controller.onPersonalPrayerDrop({
      previousIndex: 0,
      currentIndex: 1,
    } as any);

    expect(host.setPersonalPrayers).toHaveBeenCalled();
    expect(host.onFilterStateChanged).toHaveBeenCalled();
    expect(prayerService.updatePersonalPrayerOrder).toHaveBeenCalled();
  });

  it("onPersonalPrayerDrop rolls back catalog when reorder fails", async () => {
    controller.personalCategoryFilterMode = "named";
    controller.selectedPersonalCategories = ["Health"];
    const prayers = [
      { id: "a", category: "Health" } as PrayerRequest,
      { id: "b", category: "Health" } as PrayerRequest,
    ];
    host.getPersonalPrayers.mockReturnValue(prayers);
    host.getFilteredPersonalPrayers.mockReturnValue([...prayers]);
    prayerService.updatePersonalPrayerOrder.mockResolvedValue(false);

    await controller.onPersonalPrayerDrop({
      previousIndex: 0,
      currentIndex: 1,
    } as any);

    expect(host.setPersonalPrayers).toHaveBeenLastCalledWith(prayers);
    expect(host.onFilterStateChanged).toHaveBeenCalled();
  });

  describe("personal category overflow rename and delete", () => {
    it("opens rename modal for the selected category", () => {
      controller.openRenamePersonalCategoryModal("Health");

      expect(controller.showRenamePersonalCategory).toBe(true);
      expect(controller.renamingPersonalCategory).toBe("Health");
      expect(controller.personalCategoryRenameDeferInputFocus).toBe(false);
    });

    it("deletes the category, color, and clears a matching named filter", async () => {
      controller.personalCategoryFilterMode = "named";
      controller.selectedPersonalCategories = ["Health"];
      prayerService.deletePersonalCategory.mockResolvedValue(true);

      await controller.deletePersonalCategory("Health");

      expect(prayerService.deletePersonalCategory).toHaveBeenCalledWith(
        "Health"
      );
      expect(personalCategoryColorService.deleteCategory).toHaveBeenCalledWith(
        "Health"
      );
      expect(controller.personalCategoryFilterMode).toBe("total");
      expect(controller.selectedPersonalCategories).toEqual([]);
      expect(toastService.success).toHaveBeenCalledWith("Category deleted.");
    });

    it("does not clear filters when delete fails", async () => {
      controller.personalCategoryFilterMode = "named";
      controller.selectedPersonalCategories = ["Health"];
      prayerService.deletePersonalCategory.mockResolvedValue(false);

      await controller.deletePersonalCategory("Health");

      expect(personalCategoryColorService.deleteCategory).not.toHaveBeenCalled();
      expect(controller.personalCategoryFilterMode).toBe("named");
      expect(controller.selectedPersonalCategories).toEqual(["Health"]);
      expect(toastService.success).not.toHaveBeenCalled();
    });
  });

  describe("category drag scroll lock", () => {
    let viewport: HTMLElement;

    beforeEach(() => {
      const shell = document.createElement("div");
      shell.className = "main-page-shell";
      viewport = document.createElement("div");
      viewport.className = "safe-area-viewport";
      shell.appendChild(viewport);
      document.body.appendChild(shell);
    });

    afterEach(() => {
      document.body.innerHTML = "";
      document.body.style.cursor = "";
    });

    it("locks home scroll on drag start and unlocks on drag end", () => {
      controller.onCategoryDragStarted();
      expect(controller.isCategoryDragging).toBe(true);
      expect(document.body.style.cursor).toBe("grabbing");
      expect(
        viewport.classList.contains(HOME_PERSONAL_CATEGORY_DRAG_SCROLL_LOCK_CLASS)
      ).toBe(true);

      controller.onCategoryDragEnded();
      expect(controller.isCategoryDragging).toBe(false);
      expect(document.body.style.cursor).toBe("");
      expect(
        viewport.classList.contains(HOME_PERSONAL_CATEGORY_DRAG_SCROLL_LOCK_CLASS)
      ).toBe(false);
    });
  });
});
