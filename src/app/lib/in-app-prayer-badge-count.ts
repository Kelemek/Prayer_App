/**
 * In-app prayer badge counts (Current + Answered + Prompts) and the
 * all-tenant sum used by the native app icon badge.
 *
 * Locked semantics (Mark 2026-09-19):
 * - Number = in-app prayer badges currently displayed (not a notifications inbox)
 * - Tenant scope = sum across every church the member belongs to
 * - Clear/decrement when those badged surfaces are opened (same mark-read
 *   paths as the in-app pills). App open alone does not clear.
 */

export interface InAppBadgeCachedItem {
  id: string;
  status?: string;
  updates?: Array<{ id?: string }>;
}

export interface InAppBadgeReadState {
  prayers: string[];
  prayerUpdates: string[];
  prompts: string[];
  promptUpdates: string[];
}

export interface TenantInAppBadgeSnapshot {
  tenantId: string;
  prayers: InAppBadgeCachedItem[];
  prompts: InAppBadgeCachedItem[];
  readState: InAppBadgeReadState;
}

/** Surfaces that show in-app prayer badges (and drive icon-badge decrement). */
export type InAppBadgeSurface = 'current' | 'answered' | 'prompts' | 'church';

export function emptyInAppBadgeReadState(): InAppBadgeReadState {
  return {
    prayers: [],
    prayerUpdates: [],
    prompts: [],
    promptUpdates: [],
  };
}

export function scopedInAppBadgeReadCacheKey(
  tenantId: string,
  email: string
): string {
  return `badge_read:${tenantId}:${email.trim().toLowerCase()}`;
}

export function promptsCacheKeyForTenant(tenantId: string): string {
  return `prompts:${tenantId}`;
}

export function parseCachedBadgeItems(raw: unknown): InAppBadgeCachedItem[] {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!parsed) {
    return [];
  }
  if (Array.isArray(parsed)) {
    return parsed as InAppBadgeCachedItem[];
  }
  if (typeof parsed === 'object' && parsed !== null && 'data' in parsed) {
    const data = (parsed as { data?: unknown }).data;
    return Array.isArray(data) ? (data as InAppBadgeCachedItem[]) : [];
  }
  return [];
}

export function parseInAppBadgeReadState(raw: unknown): InAppBadgeReadState {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return emptyInAppBadgeReadState();
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return emptyInAppBadgeReadState();
  }
  const record = parsed as Record<string, unknown>;
  const prayerUpdates = stringArrayField(record, 'prayerUpdates');
  return {
    prayers: stringArrayField(record, 'prayers'),
    prayerUpdates:
      prayerUpdates.length > 0
        ? prayerUpdates
        : stringArrayField(record, 'updates'),
    prompts: stringArrayField(record, 'prompts'),
    promptUpdates: stringArrayField(record, 'promptUpdates'),
  };
}

function stringArrayField(
  record: Record<string, unknown>,
  key: string
): string[] {
  const value = record[key];
  return Array.isArray(value) ? (value as string[]) : [];
}

export function unionInAppBadgeReadState(
  a: InAppBadgeReadState,
  b: InAppBadgeReadState
): InAppBadgeReadState {
  return {
    prayers: Array.from(new Set([...a.prayers, ...b.prayers])),
    prayerUpdates: Array.from(new Set([...a.prayerUpdates, ...b.prayerUpdates])),
    prompts: Array.from(new Set([...a.prompts, ...b.prompts])),
    promptUpdates: Array.from(new Set([...a.promptUpdates, ...b.promptUpdates])),
  };
}

/**
 * Same algorithm as BadgeService.calculateBadgeCount: +1 per unread item and
 * +1 per unread update. Status filter matches the Current / Answered pills.
 */
export function countInAppPrayerBadgesForItems(
  items: InAppBadgeCachedItem[],
  readIds: string[],
  readUpdateIds: string[],
  status?: 'current' | 'answered'
): number {
  if (!Array.isArray(items)) {
    return 0;
  }
  let count = 0;
  for (const item of items) {
    if (status && item.status !== status) {
      continue;
    }
    if (item.id && !readIds.includes(item.id)) {
      count++;
    }
    if (item.updates && Array.isArray(item.updates)) {
      for (const update of item.updates) {
        if (update.id && !readUpdateIds.includes(update.id)) {
          count++;
        }
      }
    }
  }
  return count;
}

/**
 * Count currently displayed in-app prayer badges for one tenant:
 * Current + Answered + Prompts (not archived, personal, groups, or memorize).
 */
export function countDisplayedInAppPrayerBadges(
  snapshot: Pick<TenantInAppBadgeSnapshot, 'prayers' | 'prompts' | 'readState'>
): number {
  const current = countInAppPrayerBadgesForItems(
    snapshot.prayers,
    snapshot.readState.prayers,
    snapshot.readState.prayerUpdates,
    'current'
  );
  const answered = countInAppPrayerBadgesForItems(
    snapshot.prayers,
    snapshot.readState.prayers,
    snapshot.readState.prayerUpdates,
    'answered'
  );
  const prompts = countInAppPrayerBadgesForItems(
    snapshot.prompts,
    snapshot.readState.prompts,
    snapshot.readState.promptUpdates
  );
  return current + answered + prompts;
}

export function countDisplayedInAppPrayerBadgesAcrossTenants(
  snapshots: TenantInAppBadgeSnapshot[]
): number {
  return snapshots.reduce(
    (sum, snapshot) => sum + countDisplayedInAppPrayerBadges(snapshot),
    0
  );
}

function collectIdsForStatus(
  items: InAppBadgeCachedItem[],
  status?: 'current' | 'answered'
): { itemIds: string[]; updateIds: string[] } {
  const itemIds: string[] = [];
  const updateIds: string[] = [];
  for (const item of items) {
    if (status && item.status !== status) {
      continue;
    }
    if (item.id) {
      itemIds.push(item.id);
    }
    if (item.updates && Array.isArray(item.updates)) {
      for (const update of item.updates) {
        if (update.id) {
          updateIds.push(update.id);
        }
      }
    }
  }
  return { itemIds, updateIds };
}

function withMarkedRead(
  readState: InAppBadgeReadState,
  field: keyof InAppBadgeReadState,
  ids: string[]
): InAppBadgeReadState {
  return {
    ...readState,
    [field]: Array.from(new Set([...readState[field], ...ids])),
  };
}

/**
 * Apply the same mark-read effect as opening a badged prayer surface
 * (Current / Answered / Prompts pills, or the Church aggregate).
 */
export function markInAppBadgeSurfaceRead(
  snapshot: Pick<TenantInAppBadgeSnapshot, 'prayers' | 'prompts' | 'readState'>,
  surface: InAppBadgeSurface
): InAppBadgeReadState {
  let next = snapshot.readState;
  switch (surface) {
    case 'current': {
      const ids = collectIdsForStatus(snapshot.prayers, 'current');
      next = withMarkedRead(next, 'prayers', ids.itemIds);
      next = withMarkedRead(next, 'prayerUpdates', ids.updateIds);
      break;
    }
    case 'answered': {
      const ids = collectIdsForStatus(snapshot.prayers, 'answered');
      next = withMarkedRead(next, 'prayers', ids.itemIds);
      next = withMarkedRead(next, 'prayerUpdates', ids.updateIds);
      break;
    }
    case 'prompts': {
      const ids = collectIdsForStatus(snapshot.prompts);
      next = withMarkedRead(next, 'prompts', ids.itemIds);
      next = withMarkedRead(next, 'promptUpdates', ids.updateIds);
      break;
    }
    case 'church': {
      next = markInAppBadgeSurfaceRead({ ...snapshot, readState: next }, 'current');
      next = markInAppBadgeSurfaceRead({ ...snapshot, readState: next }, 'answered');
      break;
    }
    default: {
      const _exhaustive: never = surface;
      void _exhaustive;
      break;
    }
  }
  return next;
}

export function countDisplayedInAppPrayerBadgesAfterOpeningSurface(
  snapshot: Pick<TenantInAppBadgeSnapshot, 'prayers' | 'prompts' | 'readState'>,
  surface: InAppBadgeSurface
): number {
  return countDisplayedInAppPrayerBadges({
    prayers: snapshot.prayers,
    prompts: snapshot.prompts,
    readState: markInAppBadgeSurfaceRead(snapshot, surface),
  });
}

/** App launch / resume must not wipe the icon badge. */
export function shouldClearAppIconBadgeOnAppOpen(): boolean {
  return false;
}

export function appIconBadgeCountAfterAppOpen(currentCount: number): number {
  return currentCount;
}

export function resolveAppIconBadgeCount(options: {
  badgesEnabled: boolean;
  allTenantDisplayedCount: number;
}): number {
  if (!options.badgesEnabled) {
    return 0;
  }
  const count = options.allTenantDisplayedCount;
  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }
  return Math.floor(count);
}

export function listMemberTenantIds(input: {
  memberTenants?: Array<{ id?: string | null } | null> | null;
  memberships?: Array<{ tenant_id?: string | null } | null> | null;
  activeTenantId?: string | null;
}): string[] {
  const ids: string[] = [];
  for (const tenant of input.memberTenants ?? []) {
    if (tenant?.id) {
      ids.push(tenant.id);
    }
  }
  for (const membership of input.memberships ?? []) {
    if (membership?.tenant_id) {
      ids.push(membership.tenant_id);
    }
  }
  if (input.activeTenantId) {
    ids.push(input.activeTenantId);
  }
  return Array.from(new Set(ids));
}

export function readTenantInAppBadgeSnapshot(
  storage: Pick<Storage, 'getItem'>,
  tenantId: string,
  email: string,
  activeReadState?: InAppBadgeReadState | null
): TenantInAppBadgeSnapshot {
  const prayers = parseCachedBadgeItems(
    storage.getItem(`tenant_${tenantId}_prayers`)
  );
  const prompts = parseCachedBadgeItems(
    storage.getItem(promptsCacheKeyForTenant(tenantId))
  );
  const stored = parseInAppBadgeReadState(
    storage.getItem(scopedInAppBadgeReadCacheKey(tenantId, email))
  );
  return {
    tenantId,
    prayers,
    prompts,
    readState: activeReadState
      ? unionInAppBadgeReadState(stored, activeReadState)
      : stored,
  };
}

export function readAllTenantInAppBadgeSnapshots(
  storage: Pick<Storage, 'getItem'>,
  tenantIds: string[],
  email: string,
  activeTenantId?: string | null,
  activeReadState?: InAppBadgeReadState | null
): TenantInAppBadgeSnapshot[] {
  return tenantIds.map((tenantId) =>
    readTenantInAppBadgeSnapshot(
      storage,
      tenantId,
      email,
      activeTenantId && tenantId === activeTenantId ? activeReadState : null
    )
  );
}
