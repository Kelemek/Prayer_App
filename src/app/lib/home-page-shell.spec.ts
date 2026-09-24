import { describe, expect, it, vi } from "vitest";
import { createHomePageShell, createHomePageShellHandlers } from "./home-page-shell";

function minimalDeps(overrides: Record<string, unknown> = {}) {
  const modals = {
    showSearchPanel: true,
    showLogoutConfirmation: false,
    showHelp: false,
    showPrayerForm: false,
    showEditPersonalPrayer: false,
    showEditPersonalUpdate: false,
    toggleSearchPanel: vi.fn(),
    openUserSettings: vi.fn(),
    onPrayerFormClose: vi.fn(),
    closeUserSettings: vi.fn(),
    onSettingsScrollToSectionComplete: vi.fn(),
    handleLogout: vi.fn(),
    onPersonalPrayerSaved: vi.fn(),
    onPersonalUpdateSaved: vi.fn(),
    openEditModal: vi.fn(),
    openEditUpdateModal: vi.fn(),
    openSettingsFromReciteFeedback: vi.fn(),
  };
  return {
    modals,
    personalCategory: {
      personalCategoryFilterMode: 'all',
      personalCategoryActiveClass: 'active',
      uniquePersonalCategories: ['Family'],
      isCategoryDropListDisabled: false,
      canReorderPersonalPrayers: true,
      showRenamePersonalCategory: false,
      renamingPersonalCategory: null,
      personalCategoryRenameDeferInputFocus: false,
      isRenamingPersonalCategory: false,
      showCreatePersonalCategory: false,
      isCreatingPersonalCategory: false,
      personalCurrentPrayersCount: () => 1,
      personalAnsweredPrayersCount: () => 0,
      isCategorySwapping: () => false,
      isPersonalCategorySelected: () => true,
      selectPersonalCategoryFilterMode: vi.fn(),
      togglePersonalCategory: vi.fn(),
      onCategoryDrop: vi.fn(),
      onCategoryDragStarted: vi.fn(),
      onCategoryDragEnded: vi.fn(),
      openCreatePersonalCategoryModal: vi.fn(),
      openRenamePersonalCategoryModal: vi.fn(),
      deletePersonalCategory: vi.fn(),
      closeRenamePersonalCategoryModal: vi.fn(),
      saveRenamedPersonalCategory: vi.fn(),
      onPersonalPrayerDrop: vi.fn(),
    },
    memorizationPanel: {
      showAddMemorizedVerse: false,
      showAddMemorizedBibleBooks: false,
      showMemorizationRecommendations: false,
      memorizationRecommendationGroups: [],
      memorizationRecommendationOwnedKeys: new Set<string>(),
      addingRecommendationId: null,
      practiceMemorizedItem: null,
      showRemoveMemorizedConfirm: false,
      memorizedItemToRemove: null,
      showVerseMemorizationTranslationModal: false,
      pendingVerseMemorizationReference: null,
      pendingVerseMemorizationSuggestedTranslation: null,
      onMemorizedVerseAdded: vi.fn(),
      addRecommendedVerse: vi.fn(),
      openMemorizationRecommendations: vi.fn(),
      openMemorizationPractice: vi.fn(),
      confirmRemoveMemorizedItem: vi.fn(),
      removeMemorizedItemConfirmed: vi.fn(),
      closeMemorizationPractice: vi.fn(),
      onMemorizationPracticeComplete: vi.fn(),
      onMemorizationPersistInProgress: vi.fn(),
      onMemorizationClearInProgress: vi.fn(),
      confirmVerseMemorizationTranslation: vi.fn(),
      cancelVerseMemorizationTranslation: vi.fn(),
      beginVerseMemorizationFromCard: vi.fn(),
    },
    memorizationRecommendationsService: { loading$: { subscribe: vi.fn() } },
    catalog: { personalCategoryCount: () => 3 },
    filter: {
      getPromptCountByType: () => 2,
      getUnreadPromptCountByType: () => 1,
      togglePromptType: vi.fn(),
      setFilter: vi.fn(),
    },
    prayerCardActions: { deleteCard: vi.fn(), deletePrompt: vi.fn(), requestDeletion: vi.fn(), requestUpdateDeletion: vi.fn() },
    memberCardActions: {
      onCardAddUpdate: vi.fn(),
      onCardDeleteUpdate: vi.fn(),
      toggleMemberUpdateAnswered: vi.fn(),
    },
    helpTour: { startSectionTour: vi.fn(), startFullGuidedTour: vi.fn() },
    adminNav: { navigateToAdmin: vi.fn() },
    presentationNav: {
      presentationHandoffQueryParams: { from: "home" },
      onPresentationLinkClick: vi.fn(),
    },
    getActiveFilter: () => 'current' as const,
    getPersonalPrayers: () => [],
    ...overrides,
  };
}

describe("createHomePageShellHandlers", () => {
  it("opens logout confirmation via modals controller", () => {
    const modals = { showLogoutConfirmation: false };
    const shell = createHomePageShellHandlers({
      modals: modals as never,
      prayerCardActions: {} as never,
      memberCardActions: {} as never,
      filter: {} as never,
      personalCategory: {} as never,
      memorizationPanel: {} as never,
      helpTour: {} as never,
      adminNav: {} as never,
      presentationNav: {} as never,
      memorizationRecommendationsService: {} as never,
      catalog: {} as never,
      getActiveFilter: () => "current",
      getPersonalPrayers: () => [],
    });

    shell.header.openLogoutConfirmation();
    expect(modals.showLogoutConfirmation).toBe(true);
  });

  it("delegates togglePromptType to filter coordinator", () => {
    const togglePromptType = vi.fn();
    const shell = createHomePageShellHandlers({
      modals: {} as never,
      prayerCardActions: {} as never,
      memberCardActions: {} as never,
      filter: { togglePromptType } as never,
      personalCategory: {} as never,
      memorizationPanel: {} as never,
      helpTour: {} as never,
      adminNav: {} as never,
      presentationNav: {} as never,
      memorizationRecommendationsService: {} as never,
      catalog: {} as never,
      getActiveFilter: () => "current",
      getPersonalPrayers: () => [],
    });

    shell.prayerContent.togglePromptType("Morning");
    expect(togglePromptType).toHaveBeenCalledWith("Morning");
  });

  it("createHomePageShell exposes modal and header getters", () => {
    const shell = createHomePageShell(minimalDeps() as never);
    expect(shell.header.showSearchPanel).toBe(true);
    expect(shell.header.presentationHandoffQueryParams).toEqual({ from: "home" });
    expect(shell.modals.activeFilter).toBe("current");
    expect(shell.personalCategory.uniqueCategories).toEqual(["Family"]);
    expect(shell.getPromptCountByType("Morning")).toBe(2);
    expect(shell.personalCategory.personalCurrentCount()).toBe(1);
    shell.personalCategory.actions.selectFilterMode("current");
    shell.personalCategory.actions.toggleCategory("Family");
  });

  it("createHomePageShellHandlers delegates to deps", () => {
    const deps = minimalDeps() as never;
    const handlers = createHomePageShellHandlers(deps);
    handlers.header.openHelp();
    handlers.header.openPrayerForm();
    handlers.header.toggleSearchPanel();
    handlers.header.navigateToAdmin();
    expect(deps.modals.showHelp).toBe(true);
    handlers.modals.closeHelp();
    handlers.modals.startHelpSectionTour({ id: "x" } as never);
    handlers.modals.cancelLogout();
    handlers.modals.closeAddMemorizedVerse();
    handlers.modals.closeAddMemorizedBibleBooks();
    handlers.modals.closeMemorizationRecommendations();
    handlers.modals.addRecommendedVerse({ id: "r1" } as never);
    handlers.modals.closeMemorizationPractice();
    handlers.modals.onMemorizationPracticeComplete({ completed: true } as never);
    handlers.modals.onMemorizationPersistInProgress({} as never);
    handlers.modals.onMemorizationClearInProgress();
    handlers.modals.openSettingsFromReciteFeedback();
    handlers.modals.confirmRemoveMemorizedItem();
    handlers.modals.cancelRemoveMemorizedItem();
    handlers.modals.confirmVerseMemorizationTranslation("esv");
    handlers.modals.cancelVerseMemorizationTranslation();
    handlers.modals.onPrayerFormClose();
    handlers.modals.handleLogout();
    handlers.prayerContent.deleteCard({ id: "p1" } as never);
    handlers.prayerContent.deletePrompt("prompt-1");
    handlers.prayerContent.editPersonalPrayer({ id: "p1" } as never);
    handlers.prayerContent.openMemorizationBibleBooks();
    handlers.prayerContent.openMemorizationRecommendations();
    handlers.prayerContent.openMemorizationPractice({ id: "m1" } as never);
    handlers.prayerContent.confirmRemoveMemorizedItem({ id: "m1" } as never);
    handlers.prayerContent.openMemorizationAddVerses();
    handlers.prayerContent.onCardMemorizeVerse({
      id: "p1",
      title: "John 3:16",
      verse_translation: "esv",
    } as never);
    expect(deps.modals.showHelp).toBe(false);
    expect(deps.adminNav.navigateToAdmin).toHaveBeenCalled();
    expect(deps.memorizationPanel.beginVerseMemorizationFromCard).toHaveBeenCalled();
    expect(deps.filter.setFilter).toHaveBeenCalledWith("memorize");
  });

  it("createHomePageShell exposes all modal and personalCategory getters", () => {
    const base = minimalDeps();
    const loading$ = { subscribe: vi.fn() };
    const deps = {
      ...base,
      modals: {
        ...base.modals,
        showSettings: true,
        settingsScrollToSectionId: "print",
        showEditPersonalPrayer: true,
        editingPrayer: { id: "p-edit" },
        showEditPersonalUpdate: true,
        editingUpdate: { id: "u1" },
        editingUpdatePrayerId: "p-edit",
      },
      memorizationPanel: {
        ...base.memorizationPanel,
        showAddMemorizedVerse: true,
        showAddMemorizedBibleBooks: true,
        showMemorizationRecommendations: true,
        memorizationRecommendationGroups: [{ id: "g1" }],
        memorizationRecommendationOwnedKeys: new Set(["esv:John 3:16"]),
        addingRecommendationId: "rec-1",
        practiceMemorizedItem: { id: "m1" },
        showRemoveMemorizedConfirm: true,
        memorizedItemToRemove: { id: "m1" },
        showVerseMemorizationTranslationModal: true,
        pendingVerseMemorizationReference: "John 3:16",
        pendingVerseMemorizationSuggestedTranslation: "esv",
      },
      memorizationRecommendationsService: { loading$ },
      personalCategory: {
        ...base.personalCategory,
        personalCategoryFilterMode: "named" as const,
        isCategoryDropListDisabled: true,
        canReorderPersonalPrayers: false,
      },
      catalog: { personalCategoryCount: vi.fn(() => 4) },
      getPersonalPrayers: () => [{ id: "pp1" }],
      filter: {
        ...base.filter,
        getUnreadPromptCountByType: () => 3,
      },
    };
    const shell = createHomePageShell(deps as never);

    expect(shell.modals.showSettings).toBe(true);
    expect(shell.modals.settingsScrollToSectionId).toBe("print");
    expect(shell.modals.showEditPersonalPrayer).toBe(true);
    expect(shell.modals.editingPrayer).toEqual({ id: "p-edit" });
    expect(shell.modals.showEditPersonalUpdate).toBe(true);
    expect(shell.modals.editingUpdate).toEqual({ id: "u1" });
    expect(shell.modals.editingUpdatePrayerId).toBe("p-edit");
    expect(shell.modals.showAddMemorizedVerse).toBe(true);
    expect(shell.modals.showAddMemorizedBibleBooks).toBe(true);
    expect(shell.modals.showMemorizationRecommendations).toBe(true);
    expect(shell.modals.memorizationRecommendationGroups).toEqual([{ id: "g1" }]);
    expect(shell.modals.memorizationRecommendationOwnedKeys).toEqual(
      new Set(["esv:John 3:16"])
    );
    expect(shell.modals.addingRecommendationId).toBe("rec-1");
    expect(shell.modals.memorizationRecommendationsLoading$).toBe(loading$);
    expect(shell.modals.practiceMemorizedItem).toEqual({ id: "m1" });
    expect(shell.modals.showRemoveMemorizedConfirm).toBe(true);
    expect(shell.modals.memorizedItemToRemove).toEqual({ id: "m1" });
    expect(shell.modals.showVerseMemorizationTranslationModal).toBe(true);
    expect(shell.modals.pendingVerseMemorizationReference).toBe("John 3:16");
    expect(shell.modals.pendingVerseMemorizationSuggestedTranslation).toBe("esv");

    expect(shell.personalCategory.filterMode).toBe("named");
    expect(shell.personalCategory.isCategoryDropListDisabled).toBe(true);
    expect(shell.personalCategory.canReorderPersonalPrayers).toBe(false);
    expect(shell.personalCategory.personalAnsweredCount()).toBe(0);
    expect(shell.personalCategory.isCategorySwapping("Family")).toBe(false);
    expect(shell.personalCategory.getCategoryCount("Family")).toBe(4);
    expect(shell.getUnreadPromptCountByType("Morning")).toBe(3);

    const dropEvent = { previousIndex: 0, currentIndex: 1 } as never;
    shell.personalCategory.actions.onCategoryDrop(dropEvent);
    shell.personalCategory.actions.onCategoryDragStarted();
    shell.personalCategory.actions.onCategoryDragEnded();
    shell.personalCategory.actions.openCreateCategory();
    shell.personalCategory.actions.openRenameCategory("Family");
    shell.personalCategory.actions.deleteCategory("Family");
    expect(deps.personalCategory.onCategoryDrop).toHaveBeenCalledWith(dropEvent);
  });

  it("createHomePageShellHandlers covers remaining modal and prayerContent paths", () => {
    const deps = minimalDeps() as never;
    const handlers = createHomePageShellHandlers(deps);
    const event = { preventDefault: vi.fn() } as never;

    handlers.header.openUserSettings();
    handlers.header.onPresentationLinkClick(event);
    handlers.modals.closeUserSettings();
    handlers.modals.onSettingsScrollToSectionComplete();
    handlers.modals.closeEditPersonalPrayer();
    handlers.modals.onPersonalPrayerSaved();
    handlers.modals.closeRenamePersonalCategory();
    handlers.modals.saveRenamedPersonalCategory("Renamed");
    handlers.modals.closeEditPersonalUpdate();
    handlers.modals.onPersonalUpdateSaved();
    handlers.modals.onMemorizedVerseAdded();
    handlers.modals.startFullGuidedTour(["intro"] as never);

    handlers.prayerContent.onCardAddUpdate({ id: "p1" } as never, {
      prayer_id: "p1",
      content: "x",
    } as never);
    handlers.prayerContent.onCardDeleteUpdate({ id: "p1" } as never, {
      prayerId: "p1",
      updateId: "u1",
    } as never);
    handlers.prayerContent.requestDeletion({ prayerId: "p1" } as never);
    handlers.prayerContent.requestUpdateDeletion({
      prayerId: "p1",
      updateId: "u1",
    } as never);
    handlers.prayerContent.toggleMemberUpdateAnswered({
      prayerId: "pc-member-1",
      updateId: "u1",
      isAnswered: true,
    } as never);
    handlers.prayerContent.editPersonalUpdate({
      prayerId: "p1",
      update: { id: "u1" },
    } as never);
    handlers.prayerContent.onPersonalPrayerDrop({} as never);
    handlers.prayerContent.onCardMemorizeVerse({ id: "p1", title: "Pray" } as never);

    expect(deps.modals.openUserSettings).toHaveBeenCalled();
    expect(deps.presentationNav.onPresentationLinkClick).toHaveBeenCalledWith(event);
    expect(deps.personalCategory.saveRenamedPersonalCategory).toHaveBeenCalledWith("Renamed");
    expect(deps.memberCardActions.onCardAddUpdate).toHaveBeenCalled();
    expect(deps.prayerCardActions.requestDeletion).toHaveBeenCalled();
  });
});
