import { describe, it, expect, vi, beforeEach } from "vitest";
import { HomePrayerCardActionsController } from "./home-prayer-card-actions.controller";

describe("HomePrayerCardActionsController", () => {
  const prayerService = {
    deletePrayer: vi.fn(),
    addUpdate: vi.fn().mockResolvedValue(undefined),
    addPersonalPrayerUpdate: vi.fn().mockResolvedValue(true),
    updatePersonalPrayer: vi.fn().mockResolvedValue(undefined),
    deleteUpdate: vi.fn().mockResolvedValue(undefined),
    deletePersonalPrayerUpdate: vi.fn().mockResolvedValue(true),
    requestDeletion: vi.fn().mockResolvedValue(undefined),
    requestUpdateDeletion: vi.fn().mockResolvedValue(undefined),
    deletePersonalPrayer: vi.fn().mockResolvedValue(undefined),
  };
  const prayerGroupService = {
    deleteGroupPrayer: vi.fn(),
    addGroupPrayerUpdate: vi.fn().mockResolvedValue(true),
    deleteGroupPrayerUpdate: vi.fn().mockResolvedValue(true),
  };
  const promptService = {
    deletePrompt: vi.fn(),
  };
  const toastService = {
    error: vi.fn(),
  };
  const userSessionService = {
    getCurrentSession: vi.fn(() => ({
      email: "user@example.com",
      fullName: "User",
    })),
  };
  const prayerCardActions = {
    addUpdateForCard: vi.fn().mockResolvedValue(true),
    deleteUpdateForCard: vi.fn().mockResolvedValue(true),
    toggleMemberUpdateAnswered: vi.fn().mockResolvedValue(true),
  };
  const planningCenter = {
    reloadMemberPrayerUpdates: vi.fn().mockResolvedValue(undefined),
  };
  let controller: HomePrayerCardActionsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new HomePrayerCardActionsController(
      prayerService as any,
      prayerGroupService as any,
      promptService as any,
      toastService as any,
      userSessionService as any,
      prayerCardActions as any,
      planningCenter as any
    );
  });

  it("deletes a community prayer card", () => {
    controller.deleteCard({ id: "p1" } as any);
    expect(prayerService.deletePrayer).toHaveBeenCalledWith("p1");
  });

  it("adds a community update", async () => {
    await controller.addUpdate({ prayer_id: "p1", content: "hi" } as any);
    expect(prayerService.addUpdate).toHaveBeenCalled();
  });
});
