import type { PrayerUpdate } from '../services/prayer.service';

export interface PrayerCardAddUpdateEvent {
  prayer_id: string;
  content: string;
  author: string;
  author_email: string;
  is_anonymous: boolean;
  mark_as_answered: boolean;
}

export interface PrayerCardDeleteUpdateEvent {
  updateId: string;
  prayerId: string;
}

export interface PrayerCardDeletionRequest {
  prayer_id: string;
  requester_first_name: string;
  requester_last_name: string;
  requester_email: string;
  reason: string;
}

export interface PrayerCardUpdateDeletionRequest {
  update_id: string;
  requester_first_name: string;
  requester_last_name: string;
  requester_email: string;
  reason: string;
}

export interface PrayerCardToggleAnsweredEvent {
  updateId: string;
  prayerId: string;
  isAnswered: boolean;
}

export type { PrayerUpdate };
