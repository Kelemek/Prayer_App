import { Injectable } from "@angular/core";
import type {
  PrayerCardAddUpdateEvent,
  PrayerCardDeleteUpdateEvent,
  PrayerCardToggleAnsweredEvent,
} from "../lib/prayer-card-events";
import {
  isMemberPrayerId,
  memberPersonIdFromPrayerId,
} from "../lib/prayer-card-kind";
import {
  PrayerService,
  type PrayerRequest,
} from "./prayer.service";
import { PrayerGroupService } from "./prayer-group.service";
import type {
  PrayerDeletionRequestInput,
  UpdateDeletionRequestInput,
} from "../lib/prayer-community-deletion-requests";
import { PromptService } from "./prompt.service";
import { ToastService } from "./toast.service";
import { UserSessionService } from "./user-session.service";
import { PrayerCardActionsFacade } from "./prayer-card-actions.facade";
import { HomePlanningCenterController } from "./home-planning-center.controller";

@Injectable()
export class HomePrayerCardActionsController {
  private readonly cardAddUpdateInFlight = new Map<string, Promise<void>>();

  constructor(
    private readonly prayerService: PrayerService,
    private readonly prayerGroupService: PrayerGroupService,
    private readonly promptService: PromptService,
    private readonly toastService: ToastService,
    private readonly userSessionService: UserSessionService,
    private readonly prayerCardActions: PrayerCardActionsFacade,
    private readonly planningCenter: HomePlanningCenterController
  ) {}

  deleteCard(prayer: PrayerRequest): void {
    if (isMemberPrayerId(prayer.id)) {
      return;
    }
    if (prayer.group_id) {
      void this.prayerGroupService.deleteGroupPrayer(prayer.id);
      return;
    }
    void this.prayerService.deletePrayer(prayer.id);
  }

  deletePrompt(id: string): void {
    void this.promptService.deletePrompt(id);
  }

  async addUpdate(updateData: PrayerCardAddUpdateEvent): Promise<void> {
    try {
      await this.prayerService.addUpdate(updateData);
    } catch (error) {
      console.error("Error adding update:", error);
      this.toastService.error("Failed to submit update");
    }
  }

  async addPersonalUpdate(updateData: {
    prayer_id: string;
    content: string;
    mark_as_answered?: boolean;
  }): Promise<void> {
    try {
      const userSession = this.userSessionService.getCurrentSession();
      const author = userSession?.fullName || "Anonymous";
      const authorEmail = userSession?.email || "";

      const success = await this.prayerService.addPersonalPrayerUpdate(
        updateData.prayer_id,
        updateData.content,
        author,
        authorEmail,
        updateData.mark_as_answered || false
      );

      if (success && updateData.mark_as_answered) {
        await this.prayerService.updatePersonalPrayer(
          updateData.prayer_id,
          { category: "Answered" },
          { successToast: false }
        );
      }
    } catch (error) {
      console.error("Error adding personal prayer update:", error);
      this.toastService.error("Failed to add update");
    }
  }

  async onCardAddUpdate(
    prayer: PrayerRequest,
    event: PrayerCardAddUpdateEvent
  ): Promise<void> {
    const dedupeKey = this.cardAddUpdateDedupeKey(prayer.id, event);
    const inflight = this.cardAddUpdateInFlight.get(dedupeKey);
    if (inflight) {
      await inflight;
      return;
    }

    const task = this.runCardAddUpdate(prayer, event);
    this.cardAddUpdateInFlight.set(dedupeKey, task);
    try {
      await task;
    } finally {
      this.cardAddUpdateInFlight.delete(dedupeKey);
    }
  }

  private cardAddUpdateDedupeKey(
    prayerId: string,
    event: PrayerCardAddUpdateEvent
  ): string {
    return [
      prayerId,
      event.content,
      event.mark_as_answered ? "1" : "0",
      event.is_personal_card ? "1" : "0",
    ].join("\0");
  }

  private async runCardAddUpdate(
    prayer: PrayerRequest,
    event: PrayerCardAddUpdateEvent
  ): Promise<void> {
    if (isMemberPrayerId(prayer.id)) {
      const ok = await this.prayerCardActions.addUpdateForCard(prayer, event);
      if (ok) {
        await this.planningCenter.reloadMemberPrayerUpdates(
          memberPersonIdFromPrayerId(prayer.id)
        );
      }
      return;
    }
    if (prayer.group_id) {
      const userSession = this.userSessionService.getCurrentSession();
      await this.prayerGroupService.addGroupPrayerUpdate(
        event.prayer_id,
        event.content,
        userSession?.fullName || "Anonymous",
        userSession?.email || "",
        event.mark_as_answered || false
      );
      return;
    }
    await this.prayerCardActions.addUpdateForCard(prayer, event);
  }

  async deleteUpdate(event: PrayerCardDeleteUpdateEvent): Promise<void> {
    try {
      await this.prayerService.deleteUpdate(event.updateId);
    } catch (error) {
      console.error("Error deleting update:", error);
      this.toastService.error("Failed to delete update");
    }
  }

  async deletePersonalUpdate(event: PrayerCardDeleteUpdateEvent): Promise<void> {
    try {
      await this.prayerService.deletePersonalPrayerUpdate(event.updateId);
    } catch (error) {
      console.error("Error deleting personal prayer update:", error);
      this.toastService.error("Failed to delete update");
    }
  }

  async onCardDeleteUpdate(
    prayer: PrayerRequest,
    event: PrayerCardDeleteUpdateEvent
  ): Promise<void> {
    if (isMemberPrayerId(prayer.id)) {
      const ok = await this.prayerCardActions.deleteUpdateForCard(prayer, event);
      if (ok) {
        await this.planningCenter.reloadMemberPrayerUpdates(
          memberPersonIdFromPrayerId(prayer.id)
        );
      }
      return;
    }
    if (prayer.group_id) {
      await this.prayerGroupService.deleteGroupPrayerUpdate(
        event.updateId,
        prayer.id
      );
      return;
    }
    await this.prayerCardActions.deleteUpdateForCard(prayer, event);
  }

  async requestDeletion(requestData: PrayerDeletionRequestInput): Promise<void> {
    try {
      await this.prayerService.requestDeletion(requestData);
    } catch (error) {
      console.error("Error requesting deletion:", error);
      this.toastService.error("Failed to submit deletion request");
    }
  }

  async requestUpdateDeletion(requestData: UpdateDeletionRequestInput): Promise<void> {
    try {
      await this.prayerService.requestUpdateDeletion(requestData);
    } catch (error) {
      console.error("Error requesting update deletion:", error);
      this.toastService.error("Failed to submit update deletion request");
    }
  }

  deletePersonalPrayer(id: string): void {
    this.prayerService.deletePersonalPrayer(id).catch((error) => {
      console.error("Error deleting personal prayer:", error);
    });
  }

  async toggleMemberUpdateAnswered(
    event: PrayerCardToggleAnsweredEvent
  ): Promise<void> {
    const ok = await this.prayerCardActions.toggleMemberUpdateAnswered(event);
    if (ok) {
      await this.planningCenter.reloadMemberPrayerUpdates(
        memberPersonIdFromPrayerId(event.prayerId)
      );
    }
  }
}
