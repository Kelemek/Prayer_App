export type PrayerStatus = 'current' | 'answered' | 'archived';

export type PrayerContentKind = 'standard' | 'verse_memorization';

export interface PrayerUpdate {
  id: string;
  prayer_id: string;
  content: string;
  author: string;
  author_email?: string;
  created_at: string;
  updated_at?: string;
  is_anonymous?: boolean;
  is_answered?: boolean;
  /** Personal prayer updates use this flag. */
  mark_as_answered?: boolean;
  approval_status?: string;
}

export interface PrayerRequest {
  id: string;
  title: string;
  description: string;
  status: PrayerStatus;
  approval_status?: 'pending' | 'approved' | 'denied';
  requester: string;
  prayer_for: string;
  email?: string | null;
  is_anonymous?: boolean;
  type?: 'prayer' | 'prompt';
  date_requested: string;
  date_answered?: string | null;
  created_at: string;
  updated_at: string;
  last_reminder_sent?: string | null;
  category?: string | null;
  display_order?: number;
  prayer_image?: string | null;
  updates?: PrayerUpdate[];
  prayed_for_count?: number;
  /** Set on personal-prayer rows (legacy cache entries may only have email). */
  user_email?: string;
  /** Set when the prayer belongs to a prayer group. */
  group_id?: string;
  is_shared_personal_prayer?: boolean;
  denial_reason?: string | null;
  approved_at?: string | null;
  denied_at?: string | null;
  content_kind?: PrayerContentKind;
  verse_reference?: string | null;
  verse_translation?: string | null;
  admin_message?: string | null;
}

export interface PrayerFilters {
  status?: PrayerStatus;
  search?: string;
  type?: string;
  category?: string;
}
