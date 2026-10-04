const STORAGE_KEY_PREFIX = 'prayerapp.adminIntroTourSeen.v1';

export function adminIntroTourSeenStorageKey(tenantId: string, email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  return `${STORAGE_KEY_PREFIX}:${tenantId}:${normalizedEmail}`;
}

export function hasSeenAdminIntroTour(tenantId: string, email: string): boolean {
  if (typeof localStorage === 'undefined') {
    return true;
  }
  if (!tenantId.trim() || !email.trim()) {
    return true;
  }
  try {
    return localStorage.getItem(adminIntroTourSeenStorageKey(tenantId, email)) === '1';
  } catch {
    return true;
  }
}

export function markAdminIntroTourSeen(tenantId: string, email: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  if (!tenantId.trim() || !email.trim()) {
    return;
  }
  try {
    localStorage.setItem(adminIntroTourSeenStorageKey(tenantId, email), '1');
  } catch {
    /* quota / private mode */
  }
}
