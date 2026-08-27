import { Injectable } from "@angular/core";
import { PrayerService } from "./prayer.service";
import { PromptService } from "./prompt.service";
import { ToastService } from "./toast.service";
import { UserSessionService } from "./user-session.service";
import { AdminAuthService } from "./admin-auth.service";
import {
  getPrayerCardMutationKind,
  type PrayerCardIdentity,
} from "../lib/prayer-card-kind";
import type {
  PrayerCardAddUpdateEvent,
  PrayerCardDeleteUpdateEvent,
  PrayerCardDeletionRequest,
  PrayerCardUpdateDeletionRequest,
} from "../lib/prayer-card-events";

@Injectable({
  providedIn: "root",
})
export class PrayerCardActionsFacade {
  constructor(
    private prayerService: PrayerService,
    private promptService: PromptService,
    private toastService: ToastService,
    private userSessionService: UserSessionService,
    private adminAuthService: AdminAuthService
  ) {}

  get isAdmin(): boolean {
    return this.adminAuthService.getIsAdmin();
  }

  deleteCard(prayer: PrayerCardIdentity): void {
    void this.deleteCardForCard(prayer);
  }

  async deleteCardForCard(prayer: PrayerCardIdentity): Promise<boolean> {
    try {
      const kind = getPrayerCardMutationKind(prayer);
      switch (kind) {
        case "personal":
          return await this.prayerService.deletePersonalPrayer(prayer.id);
        case "community":
          return await this.prayerService.deletePrayer(prayer.id);
        default: {
          const _exhaustive: never = kind;
          return _exhaustive;
        }
      }
    } catch (error) {
      console.error("Error deleting prayer card:", error);
      this.toastService.error("Failed to delete prayer");
      return false;
    }
  }

  async addUpdateForCard(
    prayer: PrayerCardIdentity,
    updateData: PrayerCardAddUpdateEvent
  ): Promise<boolean> {
    try {
      const kind = getPrayerCardMutationKind(prayer);
      switch (kind) {
        case "personal":
          return await this.addPersonalUpdate(updateData);
        case "community":
          await this.prayerService.addUpdate(updateData);
          return true;
        default: {
          const _exhaustive: never = kind;
          return _exhaustive;
        }
      }
    } catch (error) {
      console.error("Error adding update:", error);
      this.toastService.error("Failed to submit update");
      return false;
    }
  }

  async deleteUpdateForCard(
    prayer: PrayerCardIdentity,
    event: PrayerCardDeleteUpdateEvent
  ): Promise<boolean> {
    try {
      const kind = getPrayerCardMutationKind(prayer);
      switch (kind) {
        case "personal": {
          const success =
            await this.prayerService.deletePersonalPrayerUpdate(event.updateId);
          return success;
        }
        case "community":
          await this.prayerService.deleteUpdate(event.updateId);
          return true;
        default: {
          const _exhaustive: never = kind;
          return _exhaustive;
        }
      }
    } catch (error) {
      console.error("Error deleting update:", error);
      this.toastService.error("Failed to delete update");
      return false;
    }
  }

  async requestDeletion(requestData: PrayerCardDeletionRequest): Promise<void> {
    try {
      await this.prayerService.requestDeletion(requestData);
    } catch (error) {
      console.error("Error requesting deletion:", error);
      this.toastService.error("Failed to submit deletion request");
    }
  }

  async requestUpdateDeletion(
    requestData: PrayerCardUpdateDeletionRequest
  ): Promise<void> {
    try {
      await this.prayerService.requestUpdateDeletion(requestData);
    } catch (error) {
      console.error("Error requesting update deletion:", error);
      this.toastService.error("Failed to submit update deletion request");
    }
  }

  async deletePrompt(id: string): Promise<boolean> {
    return this.promptService.deletePrompt(id);
  }

  private async addPersonalUpdate(
    updateData: PrayerCardAddUpdateEvent
  ): Promise<boolean> {
    const userSession = this.userSessionService.getCurrentSession();
    const author = userSession?.fullName || "Anonymous";
    const authorEmail = userSession?.email || "";

    const success = await this.prayerService.addPersonalPrayerUpdate(
      updateData.prayer_id,
      updateData.content,
      author,
      authorEmail,
      updateData.mark_as_answered
    );

    if (success && updateData.mark_as_answered) {
      await this.prayerService.updatePersonalPrayer(updateData.prayer_id, {
        category: "Answered",
      });
    }
    return success;
  }
}
