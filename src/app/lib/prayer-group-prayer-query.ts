import type { SupabaseClient } from '@supabase/supabase-js';
import type { PrayerRequest, PrayerUpdate } from './prayer-types';

export interface GroupPrayerRow {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  prayer_for: string;
  status: 'current' | 'answered';
  requester: string;
  email: string;
  is_anonymous: boolean;
  date_requested: string;
  date_answered: string | null;
  prayed_for_count: number;
  created_at: string;
  updated_at: string;
  group_prayer_updates?: GroupPrayerUpdateRow[] | null;
}

export interface GroupPrayerUpdateRow {
  id: string;
  group_prayer_id: string;
  content: string;
  author: string;
  author_email: string;
  mark_as_answered: boolean;
  created_at: string;
}

export const GROUP_PRAYERS_SELECT = `
  id,
  group_id,
  title,
  description,
  prayer_for,
  status,
  requester,
  email,
  is_anonymous,
  date_requested,
  date_answered,
  prayed_for_count,
  created_at,
  updated_at,
  group_prayer_updates (
    id,
    group_prayer_id,
    content,
    author,
    author_email,
    mark_as_answered,
    created_at
  )
`;

export function mapGroupPrayerRowToRequest(row: GroupPrayerRow): PrayerRequest {
  const updates: PrayerUpdate[] = (row.group_prayer_updates ?? []).map((update) => ({
    id: update.id,
    prayer_id: row.id,
    content: update.content,
    author: update.author,
    author_email: update.author_email,
    created_at: update.created_at,
    mark_as_answered: update.mark_as_answered,
  }));
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    prayer_for: row.prayer_for,
    requester: row.requester,
    email: row.email,
    is_anonymous: row.is_anonymous,
    date_requested: row.date_requested,
    date_answered: row.date_answered,
    created_at: row.created_at,
    updated_at: row.updated_at,
    approval_status: 'approved',
    type: 'prayer',
    updates,
    prayed_for_count: row.prayed_for_count,
    group_id: row.group_id,
  };
}

export async function fetchGroupPrayersByGroupIds(
  client: SupabaseClient,
  groupIds: string[]
): Promise<Map<string, PrayerRequest[]>> {
  const { data, error } = await client
    .from('group_prayers')
    .select(GROUP_PRAYERS_SELECT)
    .in('group_id', groupIds)
    .order('date_requested', { ascending: false });
  if (error) {
    throw error;
  }

  const grouped = new Map<string, PrayerRequest[]>();
  for (const id of groupIds) {
    grouped.set(id, []);
  }
  for (const row of (data ?? []) as GroupPrayerRow[]) {
    const prayers = grouped.get(row.group_id);
    if (!prayers) {
      continue;
    }
    prayers.push(mapGroupPrayerRowToRequest(row));
  }
  return grouped;
}
