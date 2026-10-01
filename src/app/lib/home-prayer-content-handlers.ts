import type { CdkDragDrop } from "@angular/cdk/drag-drop";
import type { PrayerRequest } from "../services/prayer.service";
import type {
  PrayerCardAddUpdateEvent,
  PrayerCardDeletionRequest,
  PrayerCardDeleteUpdateEvent,
  PrayerCardEditUpdateEvent,
  PrayerCardToggleAnsweredEvent,
  PrayerCardUpdateDeletionRequest,
} from "./prayer-card-events";
import type { MemorizedItem } from "../types/memorization";

export interface HomePrayerContentHandlers {
  deleteCard(prayer: PrayerRequest): void;
  setGroupPrayerAnswered(prayer: PrayerRequest, answered: boolean): void;
  deletePrompt(promptId: string): void;
  onCardAddUpdate(prayer: PrayerRequest, event: PrayerCardAddUpdateEvent): void;
  onCardDeleteUpdate(
    prayer: PrayerRequest,
    event: PrayerCardDeleteUpdateEvent
  ): void;
  requestDeletion(request: PrayerCardDeletionRequest): void;
  requestUpdateDeletion(request: PrayerCardUpdateDeletionRequest): void;
  toggleMemberUpdateAnswered(event: PrayerCardToggleAnsweredEvent): void;
  editPersonalPrayer(prayer: PrayerRequest): void;
  editPersonalUpdate(event: PrayerCardEditUpdateEvent): void;
  togglePromptType(type: string): void;
  onPersonalPrayerDrop(event: CdkDragDrop<PrayerRequest[]>): void;
  openMemorizationAddVerses(): void;
  openMemorizationBibleBooks(): void;
  openMemorizationRecommendations(): void;
  openMemorizationPractice(item: MemorizedItem): void;
  confirmRemoveMemorizedItem(item: MemorizedItem): void;
  onCardMemorizeVerse(prayer: PrayerRequest): void;
}
