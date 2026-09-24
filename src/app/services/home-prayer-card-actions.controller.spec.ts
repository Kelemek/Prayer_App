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
    deletePersonalPrayer: vi.fn().mockResolvedValue(true),
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

  it("skips delete for member cards and deletes group prayers", () => {
    controller.deleteCard({ id: "pc-member-abc" } as any);
    expect(prayerService.deletePrayer).not.toHaveBeenCalled();
    controller.deleteCard({ id: "g1", group_id: "grp" } as any);
    expect(prayerGroupService.deleteGroupPrayer).toHaveBeenCalledWith("g1");
  });

  it("routes group and member card updates", async () => {
    await controller.onCardAddUpdate(
      { id: "pc-member-abc" } as any,
      { prayer_id: "pc-member-abc", content: "pray" } as any
    );
    expect(prayerCardActions.addUpdateForCard).toHaveBeenCalled();
    expect(planningCenter.reloadMemberPrayerUpdates).toHaveBeenCalled();

    await controller.onCardAddUpdate(
      { id: "gp1", group_id: "grp" } as any,
      { prayer_id: "gp1", content: "thanks", mark_as_answered: true } as any
    );
    expect(prayerGroupService.addGroupPrayerUpdate).toHaveBeenCalled();
  });

  it("handles delete update paths and errors", async () => {
    await controller.onCardDeleteUpdate(
      { id: "gp1", group_id: "grp" } as any,
      { prayerId: "gp1", updateId: "u1" } as any
    );
    expect(prayerGroupService.deleteGroupPrayerUpdate).toHaveBeenCalled();

    prayerService.addUpdate.mockRejectedValueOnce(new Error("fail"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await controller.addUpdate({ prayer_id: "p1", content: "x" } as any);
    expect(toastService.error).toHaveBeenCalledWith("Failed to submit update");
    errSpy.mockRestore();
  });

  it("addPersonalUpdate marks answered and deletePersonalPrayer", async () => {
    await controller.addPersonalUpdate({
      prayer_id: "pp1",
      content: "done",
      mark_as_answered: true,
    });
    expect(prayerService.updatePersonalPrayer).toHaveBeenCalled();
    controller.deletePersonalPrayer("pp1");
    await vi.waitFor(() => prayerService.deletePersonalPrayer.mock.calls.length > 0);
  });

  it("toggleMemberUpdateAnswered reloads planning center", async () => {
    await controller.toggleMemberUpdateAnswered({
      prayerId: "pc-member-abc",
      updateId: "u1",
      isAnswered: true,
    });
    expect(planningCenter.reloadMemberPrayerUpdates).toHaveBeenCalled();
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
