import { describe, it, expect } from 'vitest';
import {
  showPrayerCardAddUpdateButton,
  showPrayerCardDeleteButton,
  showPrayerCardUpdateDeleteButton,
  type PrayerCardPermissionContext,
} from './prayer-card-permissions';

function baseContext(
  overrides: Partial<PrayerCardPermissionContext> = {}
): PrayerCardPermissionContext {
  return {
    prayerId: 'prayer-1',
    prayerEmail: 'user@example.com',
    isAdmin: false,
    isPersonal: false,
    deletionsAllowed: 'everyone',
    updatesAllowed: 'everyone',
    currentUserEmail: 'user@example.com',
    ...overrides,
  };
}

describe('showPrayerCardDeleteButton', () => {
  it('allows personal and admin deletes', () => {
    expect(showPrayerCardDeleteButton(baseContext({ isPersonal: true }))).toBe(
      true
    );
    expect(showPrayerCardDeleteButton(baseContext({ isAdmin: true }))).toBe(
      true
    );
  });

  it('respects admin-only deletion policy', () => {
    expect(
      showPrayerCardDeleteButton(
        baseContext({ deletionsAllowed: 'admin-only' })
      )
    ).toBe(false);
  });

  it('respects original-requestor deletion policy', () => {
    expect(
      showPrayerCardDeleteButton(
        baseContext({
          deletionsAllowed: 'original-requestor',
          currentUserEmail: 'other@example.com',
        })
      )
    ).toBe(false);
    expect(
      showPrayerCardDeleteButton(
        baseContext({ deletionsAllowed: 'original-requestor' })
      )
    ).toBe(true);
  });
});

describe('showPrayerCardAddUpdateButton', () => {
  it('allows personal cards regardless of policy', () => {
    expect(
      showPrayerCardAddUpdateButton(
        baseContext({
          isPersonal: true,
          updatesAllowed: 'admin-only',
        })
      )
    ).toBe(true);
  });
});

describe('showPrayerCardUpdateDeleteButton', () => {
  it('mirrors deletion policy for non-admin users', () => {
    expect(
      showPrayerCardUpdateDeleteButton(
        baseContext({ deletionsAllowed: 'original-requestor' })
      )
    ).toBe(true);
    expect(
      showPrayerCardUpdateDeleteButton(
        baseContext({
          deletionsAllowed: 'original-requestor',
          currentUserEmail: 'other@example.com',
        })
      )
    ).toBe(false);
  });
});
