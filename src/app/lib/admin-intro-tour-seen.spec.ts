import { describe, it, expect, beforeEach } from 'vitest';
import {
  adminIntroTourSeenStorageKey,
  hasSeenAdminIntroTour,
  markAdminIntroTourSeen,
} from './admin-intro-tour-seen';

describe('admin-intro-tour-seen', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses tenant and normalized email in the storage key', () => {
    expect(adminIntroTourSeenStorageKey('tenant-1', 'Admin@Example.com')).toBe(
      'prayerapp.adminIntroTourSeen.v1:tenant-1:admin@example.com'
    );
  });

  it('marks and reads seen state', () => {
    expect(hasSeenAdminIntroTour('t1', 'a@b.com')).toBe(false);
    markAdminIntroTourSeen('t1', 'a@b.com');
    expect(hasSeenAdminIntroTour('t1', 'a@b.com')).toBe(true);
    expect(hasSeenAdminIntroTour('t1', 'other@b.com')).toBe(false);
  });
});
