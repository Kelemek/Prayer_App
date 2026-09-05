import { Injectable } from "@angular/core";
import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import type { PrayerRequest } from "./prayer.service";
import type { PrayerService } from "./prayer.service";
import type { PersonalCategoryColorService } from "./personal-category-color.service";
import type { ToastService } from "./toast.service";
import type { PersonalCategoryFilterMode } from "../types/presentation";
import {
  lockHomePersonalCategoryDragScroll,
  unlockHomePersonalCategoryDragScroll,
} from "../lib/personal-category-drag-scroll";
import { HOME_PERSONAL_SUB_FILTER_CHIP_ACTIVE_CLASS } from "../lib/home-sub-filter-chip-classes";
import { namedPersonalCategoryNamesFromPrayers } from "../lib/personal-category-order";
import {
  renamePersonalCategoryWithColors,
  type RenamePersonalCategoryWithColorsResult,
} from "../lib/personal-category-rename";

export interface HomePersonalCategoryHost {
  getPersonalPrayers(): PrayerRequest[];
  setPersonalPrayers(prayers: PrayerRequest[]): void;
  getFilteredPersonalPrayers(): PrayerRequest[];
  markForCheck(): void;
  detectChanges(): void;
  onFilterStateChanged(): void;
  setIsReorderingPersonalPrayers(value: boolean): void;
}

export interface HomePersonalCategoryReturnContext {
  personalCategoryFilterMode?: PersonalCategoryFilterMode;
  selectedPersonalCategories?: string[];
}

@Injectable()
export class HomePersonalCategoryController {
  personalCategoryFilterMode: PersonalCategoryFilterMode = "current";
  selectedPersonalCategories: string[] = [];
  isCategoryDragging = false;
  private categoryDragScrollLockTarget: HTMLElement | null = null;
  private pendingCategoryOrder: string[] | null = null;
  private swappingCategories = new Set<string>();
  showRenamePersonalCategory = false;
  renamingPersonalCategory: string | null = null;
  personalCategoryRenameDeferInputFocus = false;
  isRenamingPersonalCategory = false;
  isReorderingPersonalPrayers = false;
  isDeletingPersonalCategory = false;

  readonly personalCategoryActiveClass = HOME_PERSONAL_SUB_FILTER_CHIP_ACTIVE_CLASS;

  private host: HomePersonalCategoryHost | null = null;
  private prayerService: PrayerService | null = null;
  private personalCategoryColorService: PersonalCategoryColorService | null =
    null;
  private toastService: ToastService | null = null;
  private personalCategoryRenameGeneration = 0;

  bindHost(
    host: HomePersonalCategoryHost,
    deps: {
      prayerService: PrayerService;
      personalCategoryColorService: PersonalCategoryColorService;
      toastService: ToastService;
    }
  ): void {
    this.host = host;
    this.prayerService = deps.prayerService;
    this.personalCategoryColorService = deps.personalCategoryColorService;
    this.toastService = deps.toastService;
  }

  dispose(): void {
    return;
  }

  get canReorderPersonalPrayers(): boolean {
    return (
      this.personalCategoryFilterMode === "named" &&
      this.selectedPersonalCategories.length === 1
    );
  }

  personalCurrentPrayersCount(prayers: PrayerRequest[]): number {
    return prayers.filter((p) => p.category !== "Answered").length;
  }

  personalAnsweredPrayersCount(prayers: PrayerRequest[]): number {
    return prayers.filter((p) => p.category === "Answered").length;
  }

  /** True while any named category chip is persisting a reorder. */
  get isCategoryDropListDisabled(): boolean {
    return this.swappingCategories.size > 0;
  }

  isCategorySwapping(category: string): boolean {
    return this.swappingCategories.has(category);
  }

  get uniquePersonalCategories(): string[] {
    if (this.pendingCategoryOrder !== null) {
      return this.pendingCategoryOrder;
    }
    return namedPersonalCategoryNamesFromPrayers(
      this.requirePrayerService().getPersonalPrayersSnapshot()
    );
  }

  async syncCategoriesFromPrayers(_prayers?: PrayerRequest[]): Promise<void> {
    this.pendingCategoryOrder = null;
    this.requireHost().markForCheck();
  }

  selectPersonalCategoryFilterMode(
    mode: Exclude<PersonalCategoryFilterMode, "named">
  ): void {
    this.personalCategoryFilterMode = mode;
    this.selectedPersonalCategories = [];
    this.requireHost().onFilterStateChanged();
  }

  togglePersonalCategory(category: string): void {
    if (
      this.selectedPersonalCategories.length === 1 &&
      this.selectedPersonalCategories[0] === category
    ) {
      this.selectPersonalCategoryFilterMode("total");
    } else {
      this.personalCategoryFilterMode = "named";
      this.selectedPersonalCategories = [category];
      this.requireHost().onFilterStateChanged();
    }
  }

  isPersonalCategorySelected(category: string): boolean {
    return this.selectedPersonalCategories.includes(category);
  }

  onCategoryDragStarted(): void {
    this.isCategoryDragging = true;
    document.body.style.cursor = "grabbing";
    this.categoryDragScrollLockTarget = lockHomePersonalCategoryDragScroll();
  }

  onCategoryDragEnded(): void {
    this.isCategoryDragging = false;
    document.body.style.cursor = "";
    unlockHomePersonalCategoryDragScroll(this.categoryDragScrollLockTarget);
    this.categoryDragScrollLockTarget = null;
  }

  async onCategoryDrop(event: CdkDragDrop<string[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    if (this.isCategoryDropListDisabled) {
      return;
    }

    const originalCategories = [...this.uniquePersonalCategories];
    const isAdjacentSwap =
      Math.abs(event.previousIndex - event.currentIndex) === 1;
    const categoriesInvolved = isAdjacentSwap
      ? [
          originalCategories[event.previousIndex],
          originalCategories[event.currentIndex],
        ]
      : [...originalCategories];

    const reorderedCategories = [...originalCategories];
    moveItemInArray(
      reorderedCategories,
      event.previousIndex,
      event.currentIndex
    );
    this.pendingCategoryOrder = reorderedCategories;
    this.setSwappingCategories(categoriesInvolved);
    this.requireHost().markForCheck();

    const prayerService = this.requirePrayerService();
    try {
      let success = false;

      if (isAdjacentSwap) {
        const categoryA = originalCategories[event.previousIndex];
        const categoryB = originalCategories[event.currentIndex];
        success = await prayerService.swapCategoryRanges(
          categoryA,
          categoryB
        );
      } else {
        success = await prayerService.reorderCategories(reorderedCategories);
      }

      if (!success) {
        this.requireToastService().error("Failed to reorder categories");
      }
    } catch (error) {
      console.error("Error reordering categories:", error);
      this.requireToastService().error("Failed to reorder categories");
    } finally {
      this.pendingCategoryOrder = null;
      this.clearSwappingCategories();
      this.requireHost().markForCheck();
    }
  }

  async onPersonalPrayerDrop(
    event: CdkDragDrop<PrayerRequest[]>
  ): Promise<void> {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    if (!this.canReorderPersonalPrayers) {
      this.requireToastService().error("Select a single category to reorder prayers");
      return;
    }

    const host = this.requireHost();
    const prayerService = this.requirePrayerService();
    const originalPersonalPrayers = [...host.getPersonalPrayers()];

    try {
      this.isReorderingPersonalPrayers = true;
      host.setIsReorderingPersonalPrayers(true);

      const filteredPrayers = [...host.getFilteredPersonalPrayers()];
      const movedPrayer = filteredPrayers[event.previousIndex];

      moveItemInArray(filteredPrayers, event.previousIndex, event.currentIndex);

      const personalPrayers = [...host.getPersonalPrayers()];
      const oldIndex = personalPrayers.findIndex((p) => p.id === movedPrayer.id);
      if (oldIndex !== -1) {
        personalPrayers.splice(oldIndex, 1);
      }

      const newPositionInFiltered = event.currentIndex;
      if (newPositionInFiltered === 0) {
        const firstPrayer = filteredPrayers[1];
        if (firstPrayer) {
          const firstIndex = personalPrayers.findIndex(
            (p) => p.id === firstPrayer.id
          );
          personalPrayers.splice(firstIndex, 0, movedPrayer);
        } else {
          personalPrayers.push(movedPrayer);
        }
      } else {
        const previousPrayer = filteredPrayers[newPositionInFiltered - 1];
        const previousIndex = personalPrayers.findIndex(
          (p) => p.id === previousPrayer.id
        );
        personalPrayers.splice(previousIndex + 1, 0, movedPrayer);
      }

      host.setPersonalPrayers(personalPrayers);
      host.onFilterStateChanged();

      const success = await prayerService.updatePersonalPrayerOrder(
        filteredPrayers
      );

      if (success) {
        host.onFilterStateChanged();
      } else {
        this.requireToastService().error("Failed to reorder prayers");
        host.setPersonalPrayers(originalPersonalPrayers);
        host.onFilterStateChanged();
      }
    } catch (error) {
      console.error("Error reordering personal prayers:", error);
      this.requireToastService().error("Failed to reorder prayers");
      host.setPersonalPrayers(originalPersonalPrayers);
      host.onFilterStateChanged();
    } finally {
      this.isReorderingPersonalPrayers = false;
      host.setIsReorderingPersonalPrayers(false);
    }
  }

  openRenamePersonalCategoryModal(category: string): void {
    this.personalCategoryRenameDeferInputFocus = false;
    this.renamingPersonalCategory = category;
    this.showRenamePersonalCategory = true;
    this.requireHost().markForCheck();
  }

  closeRenamePersonalCategoryModal(cancelInFlightSave = true): void {
    if (cancelInFlightSave && this.isRenamingPersonalCategory) {
      this.personalCategoryRenameGeneration++;
      this.isRenamingPersonalCategory = false;
    }
    this.personalCategoryRenameDeferInputFocus = false;
    this.showRenamePersonalCategory = false;
    this.renamingPersonalCategory = null;
    this.requireHost().markForCheck();
  }

  async saveRenamedPersonalCategory(newName: string): Promise<void> {
    const oldName = this.renamingPersonalCategory;
    if (!oldName) {
      return;
    }

    const trimmedNewName = newName.trim();
    if (!trimmedNewName || trimmedNewName === oldName) {
      this.closeRenamePersonalCategoryModal(false);
      return;
    }

    const generation = this.personalCategoryRenameGeneration;
    const previousSelection = [...this.selectedPersonalCategories];
    const prayerService = this.requirePrayerService();
    const personalCategoryColorService = this.requirePersonalCategoryColorService();
    const toastService = this.requireToastService();

    this.isRenamingPersonalCategory = true;
    this.requireHost().markForCheck();
    try {
      const result = await renamePersonalCategoryWithColors(
        prayerService,
        personalCategoryColorService,
        toastService,
        oldName,
        trimmedNewName,
        {
          onPrayersRenamed: (appliedCategory) => {
            if (generation !== this.personalCategoryRenameGeneration) {
              return;
            }
            this.selectedPersonalCategories =
              this.selectedPersonalCategories.map((category) =>
                category === oldName ? appliedCategory : category
              );
            this.requireHost().markForCheck();
          },
          isCancelled: () =>
            generation !== this.personalCategoryRenameGeneration,
        }
      );
      if (generation !== this.personalCategoryRenameGeneration) {
        this.applyDismissedPersonalCategoryRenameResult(
          result,
          oldName,
          trimmedNewName,
          previousSelection
        );
        return;
      }
      if (result.status === "failed" || result.status === "cancelled") {
        this.selectedPersonalCategories = previousSelection;
        this.requireHost().markForCheck();
        return;
      }

      if (result.status === "success") {
        toastService.success("Category renamed.");
      }
      this.closeRenamePersonalCategoryModal(false);
    } finally {
      if (generation === this.personalCategoryRenameGeneration) {
        this.isRenamingPersonalCategory = false;
      }
      this.requireHost().markForCheck();
    }
  }

  async deletePersonalCategory(category: string): Promise<void> {
    if (
      this.isDeletingPersonalCategory ||
      this.isCategoryDropListDisabled ||
      this.isCategoryDragging
    ) {
      return;
    }

    this.isDeletingPersonalCategory = true;
    this.requireHost().markForCheck();
    try {
      const deleted = await this.requirePrayerService().deletePersonalCategory(
        category
      );
      if (!deleted) {
        return;
      }

      await this.requirePersonalCategoryColorService().deleteCategory(category);

      if (this.selectedPersonalCategories.includes(category)) {
        this.selectPersonalCategoryFilterMode("total");
      } else {
        this.requireHost().onFilterStateChanged();
      }
      this.requireToastService().success("Category deleted.");
    } finally {
      this.isDeletingPersonalCategory = false;
      this.requireHost().markForCheck();
    }
  }

  applyReturnContext(context: HomePersonalCategoryReturnContext): void {
    let mode = context.personalCategoryFilterMode ?? "total";
    if (mode === "named" && !context.selectedPersonalCategories?.length) {
      mode = "total";
    }
    this.personalCategoryFilterMode = mode;
    if (mode === "named" && context.selectedPersonalCategories?.length) {
      this.selectedPersonalCategories = [
        ...context.selectedPersonalCategories,
      ];
    } else {
      this.selectedPersonalCategories = [];
    }
    this.requireHost().onFilterStateChanged();
  }

  private applyDismissedPersonalCategoryRenameResult(
    result: RenamePersonalCategoryWithColorsResult,
    oldName: string,
    newName: string,
    previousSelection: string[]
  ): void {
    switch (result.status) {
      case "cancelled":
      case "failed":
        this.selectedPersonalCategories = previousSelection;
        this.requireHost().markForCheck();
        return;
      case "success":
        this.selectedPersonalCategories = previousSelection.map((category) =>
          category === oldName ? newName : category
        );
        this.requireHost().markForCheck();
        return;
      case "partial":
        this.selectedPersonalCategories = previousSelection.map((category) =>
          category === oldName ? result.appliedCategory : category
        );
        this.requireHost().markForCheck();
        return;
      default: {
        const _exhaustive: never = result;
        void _exhaustive;
        return;
      }
    }
  }

  /** Test hook: simulate in-flight category reorder. */
  setSwappingCategoriesForTests(...categories: string[]): void {
    this.setSwappingCategories(categories);
  }

  setUniquePersonalCategoriesForTests(categories: string[]): void {
    this.pendingCategoryOrder = [...categories];
  }

  private setSwappingCategories(categories: string[]): void {
    this.swappingCategories = new Set(
      categories.filter((category): category is string => !!category)
    );
  }

  private clearSwappingCategories(): void {
    this.swappingCategories.clear();
  }

  private requireHost(): HomePersonalCategoryHost {
    if (!this.host) {
      throw new Error("HomePersonalCategoryController host is not bound");
    }
    return this.host;
  }

  private requirePrayerService(): PrayerService {
    if (!this.prayerService) {
      throw new Error("HomePersonalCategoryController prayerService is not bound");
    }
    return this.prayerService;
  }

  private requirePersonalCategoryColorService(): PersonalCategoryColorService {
    if (!this.personalCategoryColorService) {
      throw new Error(
        "HomePersonalCategoryController personalCategoryColorService is not bound"
      );
    }
    return this.personalCategoryColorService;
  }

  private requireToastService(): ToastService {
    if (!this.toastService) {
      throw new Error("HomePersonalCategoryController toastService is not bound");
    }
    return this.toastService;
  }
}
