import {
  emptyInAppBadgeReadState,
  parseInAppBadgeReadState,
  scopedInAppBadgeReadCacheKey,
  unionInAppBadgeReadState,
  type InAppBadgeReadState,
} from './in-app-prayer-badge-count';

export function tenantBadgePendingSeedKey(
  tenantId: string,
  email: string
): string {
  return `badge_seed_pending:${tenantId}:${email}`;
}

export function tenantBadgeOrphanNoneReadKey(email: string): string {
  return `badge_read:_none_:${email}`;
}

export function resolveTenantScopedReadCacheKey(
  tenantId: string | null,
  email: string | null
): string | null {
  if (!email || !tenantId) {
    return null;
  }
  return scopedInAppBadgeReadCacheKey(tenantId, email);
}

export function readPendingSeedFlag(storageKey: string | null): boolean {
  if (!storageKey || typeof localStorage === 'undefined') {
    return false;
  }
  try {
    return localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

export function writePendingSeedFlag(
  storageKey: string | null,
  pending: boolean
): void {
  if (!storageKey || typeof localStorage === 'undefined') {
    return;
  }
  try {
    if (pending) {
      localStorage.setItem(storageKey, '1');
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch {
    // ignore
  }
}

export function applyScopedReadStateFromStorage(
  storageKey: string | null,
  inMemory: InAppBadgeReadState,
  persistIfMissing: () => void
): InAppBadgeReadState {
  if (!storageKey || typeof localStorage === 'undefined') {
    return inMemory;
  }
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      persistIfMissing();
      return inMemory;
    }
    const fromCache = parseInAppBadgeReadState(stored);
    return unionInAppBadgeReadState(fromCache, inMemory);
  } catch (error) {
    console.warn('[Badge] Failed to parse scoped read cache:', error);
    return inMemory;
  }
}

export function persistScopedReadState(
  storageKey: string | null,
  state: InAppBadgeReadState
): void {
  if (!storageKey || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    console.warn('[Badge] Failed to persist scoped read cache:', error);
  }
}

export { emptyInAppBadgeReadState };
