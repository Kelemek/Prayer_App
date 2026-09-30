import { groupPrayersCacheKey } from './prayer-tenant';
import {
  countInAppPrayerBadgesForItems,
  parseCachedBadgeItems,
  type InAppBadgeCachedItem,
} from './in-app-prayer-badge-count';

/** Email-scoped read state for group prayer badges (not tied to active church). */
export interface GroupBadgeReadState {
  groupPrayers: string[];
  groupPrayerUpdates: string[];
}

export type GroupBadgeReceiptKind = 'group_prayer' | 'group_prayer_update';

export interface GroupBadgeReceiptRow {
  item_kind: GroupBadgeReceiptKind;
  item_id: string;
  group_id: string;
}

export function emptyGroupBadgeReadState(): GroupBadgeReadState {
  return { groupPrayers: [], groupPrayerUpdates: [] };
}

export function groupBadgeReadCacheKey(email: string): string {
  return `badge_read_groups:${email.trim().toLowerCase()}`;
}

/** Active group membership ids (hydrated by PrayerGroupService.loadMyGroups). */
export function memberPrayerGroupIdsCacheKey(email: string): string {
  return `memberPrayerGroupIds:${email.trim().toLowerCase()}`;
}

export function readMemberPrayerGroupIdsFromStorage(
  storage: Pick<Storage, 'getItem'>,
  email: string | null | undefined
): string[] | null {
  if (!email?.trim()) {
    return null;
  }
  const raw = storage.getItem(memberPrayerGroupIdsCacheKey(email));
  if (raw == null || raw === '') {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (id): id is string => typeof id === 'string' && id.length > 0
    );
  } catch {
    return [];
  }
}

export function writeMemberPrayerGroupIdsToStorage(
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  email: string,
  groupIds: string[]
): void {
  const key = memberPrayerGroupIdsCacheKey(email);
  const unique = Array.from(new Set(groupIds.filter(Boolean)));
  try {
    if (unique.length === 0) {
      storage.setItem(key, JSON.stringify([]));
    } else {
      storage.setItem(key, JSON.stringify(unique));
    }
    dispatchMemberPrayerGroupIdsUpdated(email);
  } catch {
    // ignore quota errors
  }
}

export const MEMBER_PRAYER_GROUP_IDS_UPDATED_EVENT =
  'prayer-app-member-prayer-group-ids-updated';

export function dispatchMemberPrayerGroupIdsUpdated(email: string): void {
  if (typeof window === 'undefined' || !email.trim()) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(MEMBER_PRAYER_GROUP_IDS_UPDATED_EVENT, {
      detail: { email: email.trim().toLowerCase() },
    })
  );
}

export function parseGroupBadgeReadState(raw: unknown): GroupBadgeReadState {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return emptyGroupBadgeReadState();
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return emptyGroupBadgeReadState();
  }
  const record = parsed as Record<string, unknown>;
  const prayerUpdates = stringArrayField(record, 'groupPrayerUpdates');
  return {
    groupPrayers: stringArrayField(record, 'groupPrayers'),
    groupPrayerUpdates:
      prayerUpdates.length > 0
        ? prayerUpdates
        : stringArrayField(record, 'groupUpdates'),
  };
}

function stringArrayField(
  record: Record<string, unknown>,
  key: string
): string[] {
  const value = record[key];
  return Array.isArray(value) ? (value as string[]) : [];
}

export function receiptsToGroupReadState(
  rows: GroupBadgeReceiptRow[]
): GroupBadgeReadState {
  const next = emptyGroupBadgeReadState();
  for (const row of rows) {
    const id = String(row.item_id);
    switch (row.item_kind) {
      case 'group_prayer':
        next.groupPrayers.push(id);
        break;
      case 'group_prayer_update':
        next.groupPrayerUpdates.push(id);
        break;
      default: {
        const _exhaustive: never = row.item_kind;
        void _exhaustive;
        break;
      }
    }
  }
  return next;
}

export function unionGroupBadgeReadState(
  a: GroupBadgeReadState,
  b: GroupBadgeReadState
): GroupBadgeReadState {
  return {
    groupPrayers: Array.from(new Set([...a.groupPrayers, ...b.groupPrayers])),
    groupPrayerUpdates: Array.from(
      new Set([...a.groupPrayerUpdates, ...b.groupPrayerUpdates])
    ),
  };
}

export function listGroupIdsFromStorage(
  storage: Pick<Storage, 'key' | 'length'>
): string[] {
  const prefix = 'groupPrayers:';
  const ids: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) {
      ids.push(key.slice(prefix.length));
    }
  }
  return Array.from(new Set(ids));
}

/** Same group scope for badge counts, mark-all-read, and unread lookups. */
export function resolveGroupBadgeTargetGroupIds(
  storage: Pick<Storage, 'key' | 'length'>,
  options?: {
    groupId?: string;
    explicitGroupIds?: string[];
    memberGroupIds?: string[] | null;
  }
): string[] {
  const memberGroupIds = options?.memberGroupIds;
  const explicitGroupIds = options?.explicitGroupIds ?? [];
  if (options?.groupId != null && options.groupId !== '') {
    if (memberGroupIds != null && !memberGroupIds.includes(options.groupId)) {
      return [];
    }
    return [options.groupId];
  }
  if (memberGroupIds != null) {
    return memberGroupIds;
  }
  if (explicitGroupIds.length > 0) {
    return explicitGroupIds;
  }
  return [];
}

export function readGroupPrayerItemsFromStorage(
  storage: Pick<Storage, 'getItem'>,
  groupId: string
): InAppBadgeCachedItem[] {
  return parseCachedBadgeItems(storage.getItem(groupPrayersCacheKey(groupId)));
}

export function countDisplayedGroupBadgesForItems(
  items: InAppBadgeCachedItem[],
  readState: GroupBadgeReadState,
  status?: 'current' | 'answered',
  viewerEmail?: string | null
): number {
  return countInAppPrayerBadgesForItems(
    items,
    readState.groupPrayers,
    readState.groupPrayerUpdates,
    status,
    viewerEmail
  );
}

export function countDisplayedGroupBadgesAcrossCaches(
  storage: Pick<Storage, 'getItem' | 'key' | 'length'>,
  groupIds: string[],
  readState: GroupBadgeReadState,
  options?: {
    status?: 'current' | 'answered';
    groupId?: string;
    viewerEmail?: string | null;
    /** When set (including `[]`), only these groups count — never orphan `groupPrayers:` caches. */
    memberGroupIds?: string[] | null;
  }
): number {
  const viewerEmail = options?.viewerEmail;
  const targets = resolveGroupBadgeTargetGroupIds(storage, {
    groupId: options?.groupId,
    explicitGroupIds: groupIds,
    memberGroupIds: options?.memberGroupIds,
  });

  return targets.reduce((sum, groupId) => {
    const items = readGroupPrayerItemsFromStorage(storage, groupId);
    if (options?.status) {
      return (
        sum +
        countDisplayedGroupBadgesForItems(
          items,
          readState,
          options.status,
          viewerEmail
        )
      );
    }
    return (
      sum +
      countDisplayedGroupBadgesForItems(items, readState, 'current', viewerEmail) +
      countDisplayedGroupBadgesForItems(items, readState, 'answered', viewerEmail)
    );
  }, 0);
}
