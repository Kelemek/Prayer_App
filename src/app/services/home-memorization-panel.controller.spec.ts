import { describe, it, expect, vi, beforeEach } from "vitest";
import { HomeMemorizationPanelController } from "./home-memorization-panel.controller";
import type { MemorizedItem } from "../types/memorization";

function createController() {
  const controller = new HomeMemorizationPanelController();
  const host = {
    markForCheck: vi.fn(),
    detectChanges: vi.fn(),
    primeKeyboardBridge: vi.fn(),
  };
  const memorizationService = {
    getPreferredTranslation: vi.fn(() => "esv" as const),
    addVerse: vi.fn().mockResolvedValue({ ok: true }),
    loadItems: vi.fn().mockResolvedValue(undefined),
    items: [] as MemorizedItem[],
    updatePracticeStats: vi.fn().mockResolvedValue(undefined),
    saveInProgress: vi.fn(),
    clearInProgress: vi.fn(),
    removeItem: vi.fn().mockResolvedValue(undefined),
  };
  const memorizationRecommendationsService = {
    load: vi.fn().mockResolvedValue(undefined),
    groupedSnapshot: [{ id: "g1", title: "Group", items: [] }],
  };
  const scriptureService = {
    getPassage: vi.fn().mockResolvedValue({ text: "For God so loved..." }),
  };
  const toastService = {
    success: vi.fn(),
    error: vi.fn(),
  };
  controller.bindHost(host, {
    memorizationService: memorizationService as never,
    memorizationRecommendationsService:
      memorizationRecommendationsService as never,
    scriptureService: scriptureService as never,
    toastService: toastService as never,
  });
  return {
    controller,
    host,
    memorizationService,
    memorizationRecommendationsService,
    scriptureService,
    toastService,
  };
}

describe("HomeMemorizationPanelController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncMemorizedItems updates counts and owned recommendation keys", () => {
    const { controller } = createController();
    controller.syncMemorizedItems([
      {
        id: "1",
        reference: "John 3:16",
        translation: "esv",
        kind: "verse",
      } as MemorizedItem,
    ]);
    expect(controller.memorizedItemsCount).toBe(1);
    expect(controller.memorizationRecommendationOwnedKeys).toEqual(
      new Set(["esv:John 3:16"])
    );
  });

  it("openMemorizationPractice primes keyboard bridge for in-progress type sessions", () => {
    const { controller, host } = createController();
    const item = {
      id: "v1",
      inProgressPractice: { phase: { kind: "inRound" }, practiceMode: "type" },
    } as MemorizedItem;
    controller.openMemorizationPractice(item);
    expect(host.primeKeyboardBridge).toHaveBeenCalled();
    expect(controller.practiceMemorizedItem).toEqual(item);
    expect(host.detectChanges).toHaveBeenCalled();
  });

  it("closeMemorizationPractice clears active practice item", () => {
    const { controller } = createController();
    controller.practiceMemorizedItem = { id: "v1" } as MemorizedItem;
    controller.closeMemorizationPractice();
    expect(controller.practiceMemorizedItem).toBeNull();
  });

  const sampleRec = {
    id: "rec-1",
    reference: "John 3:16",
    categoryId: "cat-1",
    sortOrder: 0,
  };

  it("addRecommendedVerse fetches passage and adds verse", async () => {
    const { controller, toastService, memorizationService } = createController();
    await controller.addRecommendedVerse({
      recommendation: sampleRec as never,
      translation: "esv",
    });
    expect(memorizationService.addVerse).toHaveBeenCalled();
    expect(toastService.success).toHaveBeenCalled();
  });

  it("addRecommendedVerse surfaces empty passage text", async () => {
    const { controller, scriptureService, toastService } = createController();
    scriptureService.getPassage.mockResolvedValue({ text: "   " });
    await controller.addRecommendedVerse({
      recommendation: sampleRec as never,
      translation: "esv",
    });
    expect(toastService.error).toHaveBeenCalledWith(
      "No text returned for this passage."
    );
  });

  it("promptVerseMemorizationTranslation opens modal state", () => {
    const { controller, host } = createController();
    controller.promptVerseMemorizationTranslation("Romans 8:28", "esv");
    expect(controller.showVerseMemorizationTranslationModal).toBe(true);
    expect(controller.pendingVerseMemorizationReference).toBe("Romans 8:28");
    expect(host.markForCheck).toHaveBeenCalled();
  });

  it("confirmVerseMemorizationTranslation starts practice flow", async () => {
    const { controller, memorizationService } = createController();
    memorizationService.items = [
      {
        id: "v2",
        reference: "Romans 8:28",
        translation: "esv",
        kind: "verse",
      } as MemorizedItem,
    ];
    controller.pendingVerseMemorizationReference = "Romans 8:28";
    controller.showVerseMemorizationTranslationModal = true;
    controller.confirmVerseMemorizationTranslation("esv");
    await vi.waitFor(() => controller.practiceMemorizedItem !== null);
    expect(controller.showVerseMemorizationTranslationModal).toBe(false);
  });

  it("cancelVerseMemorizationTranslation clears pending state", () => {
    const { controller } = createController();
    controller.pendingVerseMemorizationReference = "Psalm 23";
    controller.cancelVerseMemorizationTranslation();
    expect(controller.pendingVerseMemorizationReference).toBeNull();
    expect(controller.showVerseMemorizationTranslationModal).toBe(false);
  });

  it("beginVerseMemorizationFromCard opens existing verse item", async () => {
    const { controller, memorizationService } = createController();
    memorizationService.items = [
      {
        id: "existing",
        reference: "John 3:16",
        translation: "esv",
        kind: "verse",
      } as MemorizedItem,
    ];
    await controller.beginVerseMemorizationFromCard("John 3:16", "esv");
    expect(controller.practiceMemorizedItem?.id).toBe("existing");
  });

  it("onMemorizationPracticeComplete refreshes practice item", async () => {
    const { controller, memorizationService } = createController();
    const item = { id: "v1", reference: "John 3:16", translation: "esv" } as MemorizedItem;
    controller.practiceMemorizedItem = item;
    memorizationService.items = [{ ...item, practiceCount: 2 } as MemorizedItem];
    await controller.onMemorizationPracticeComplete({
      wrongAttempts: 0,
      correctKeystrokes: 10,
      completed: true,
    });
    expect(memorizationService.updatePracticeStats).toHaveBeenCalled();
    expect(controller.practiceMemorizedItem?.practiceCount).toBe(2);
  });

  it("onMemorizationPersistInProgress and clear delegate to service", () => {
    const { controller, memorizationService } = createController();
    controller.practiceMemorizedItem = { id: "v1" } as MemorizedItem;
    controller.onMemorizationPersistInProgress({ phase: { kind: "inRound" } } as never);
    controller.onMemorizationClearInProgress();
    expect(memorizationService.saveInProgress).toHaveBeenCalled();
    expect(memorizationService.clearInProgress).toHaveBeenCalled();
  });

  it("removeMemorizedItemConfirmed removes item and closes practice", async () => {
    const { controller, memorizationService } = createController();
    const item = { id: "v1" } as MemorizedItem;
    controller.practiceMemorizedItem = item;
    controller.memorizedItemToRemove = item;
    controller.showRemoveMemorizedConfirm = true;
    await controller.removeMemorizedItemConfirmed();
    expect(memorizationService.removeItem).toHaveBeenCalledWith("v1");
    expect(controller.practiceMemorizedItem).toBeNull();
  });

  it("openMemorizationRecommendations loads recommendations", async () => {
    const { controller, memorizationRecommendationsService } = createController();
    controller.openMemorizationRecommendations();
    await vi.waitFor(() =>
      memorizationRecommendationsService.load.mock.calls.length > 0
    );
    expect(controller.showMemorizationRecommendations).toBe(true);
    expect(controller.memorizationRecommendationGroups.length).toBe(1);
  });

  it("isRecommendationAlreadyAdded checks owned keys", () => {
    const { controller } = createController();
    controller.syncMemorizedItems([
      { id: "1", reference: "John 3:16", translation: "esv", kind: "verse" } as MemorizedItem,
    ]);
    expect(
      controller.isRecommendationAlreadyAdded(sampleRec as never, "esv")
    ).toBe(true);
  });
});
