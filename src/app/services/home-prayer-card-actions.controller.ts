import { Injectable } from "@angular/core";
import type {
  PrayerCardAddUpdateEvent,
  PrayerCardDeleteUpdateEvent,
} from "../lib/prayer-card-events";
import {
  PrayerService,
  type PrayerRequest,
} from "./prayer.service";
import type {
  PrayerDeletionRequestInput,
  UpdateDeletionRequestInput,
} from "../lib/prayer-community-deletion-requests";
import { PromptService } from "./prompt.service";
import { ToastService } from "./toast.service";
import { UserSessionService } from "./user-session.service";

@Injectable()
export class HomePrayerCardActionsController {
  constructor(
    private readonly prayerService: PrayerService,
    private readonly promptService: PromptService,
    private readonly toastService: ToastService,
    private readonly userSessionService: UserSessionService
  ) {}

  deleteCard(prayer: PrayerRequest): void {
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
        await this.prayerService.updatePersonalPrayer(updateData.prayer_id, {
          category: "Answered",
        });
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
    if (prayer.email || prayer.category != null) {
      await this.addPersonalUpdate(event);
      return;
    }
    await this.addUpdate(event);
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
    if (prayer.email || prayer.category != null) {
      await this.deletePersonalUpdate(event);
      return;
    }
    await this.deleteUpdate(event);
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
}
