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

  it("routes community card add-update through facade when requester email is set", async () => {
    const event = { prayer_id: "p1", content: "thanks", mark_as_answered: true };
    await controller.onCardAddUpdate(
      {
        id: "p1",
        email: "requester@example.com",
      } as any,
      event as any
    );
    expect(prayerCardActions.addUpdateForCard).toHaveBeenCalledWith(
      { id: "p1", email: "requester@example.com" },
      event
    );
    expect(prayerService.addPersonalPrayerUpdate).not.toHaveBeenCalled();
  });

  it("routes personal card add-update through facade when user_email is set", async () => {
    const event = { prayer_id: "pp1", content: "answered", mark_as_answered: true };
    await controller.onCardAddUpdate(
      { id: "pp1", user_email: "me@example.com", email: "me@example.com" } as any,
      event as any
    );
    expect(prayerCardActions.addUpdateForCard).toHaveBeenCalled();
    expect(prayerService.addUpdate).not.toHaveBeenCalled();
  });

  it("dedupes concurrent identical card add-update submissions", async () => {
    let resolveAdd!: () => void;
    prayerCardActions.addUpdateForCard.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveAdd = () => resolve(true);
        })
    );
    const event = {
      prayer_id: "p1",
      content: "thanks",
      mark_as_answered: false,
      is_personal_card: false,
    };
    const prayer = { id: "p1", email: "a@example.com" };
    const first = controller.onCardAddUpdate(prayer as any, event as any);
    const second = controller.onCardAddUpdate(prayer as any, event as any);
    resolveAdd();
    await Promise.all([first, second]);
    expect(prayerCardActions.addUpdateForCard).toHaveBeenCalledTimes(1);
  });
});
