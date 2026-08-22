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
  let controller: HomePrayerCardActionsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new HomePrayerCardActionsController(
      prayerService as any,
      promptService as any,
      toastService as any,
      userSessionService as any
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
