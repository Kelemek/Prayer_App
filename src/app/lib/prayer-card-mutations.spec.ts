import { describe, expect, it, vi } from 'vitest';
import {
  buildPrayerCardAddUpdateEvent,
  prayerCardUpdateActionsMode,
  prayerUpdateFromRecord,
} from './prayer-card-mutations';

describe('prayer-card-mutations', () => {
  it('buildPrayerCardAddUpdateEvent maps payload and session', () => {
    const userSessionService = {
      getCurrentSession: () => ({ fullName: 'User' }),
    };
    const event = buildPrayerCardAddUpdateEvent(
      'p1',
      {
        content: 'Thanks',
        is_anonymous: true,
        mark_as_answered: true,
      } as never,
      userSessionService as never,
      true
    );
    expect(event.prayer_id).toBe('p1');
    expect(event.is_personal_card).toBe(true);
    expect(event.is_anonymous).toBe(true);
  });

  it('prayerUpdateFromRecord maps fields', () => {
    const update = prayerUpdateFromRecord(
      {
        id: 'u1',
        content: 'c',
        author: 'a',
        created_at: 't1',
        updated_at: 't2',
        is_answered: true,
        is_anonymous: false,
      },
      'p1'
    );
    expect(update.prayer_id).toBe('p1');
    expect(update.is_answered).toBe(true);
  });

  it('mode helpers', () => {
    expect(prayerCardUpdateActionsMode(true)).toBe('personal');
    expect(prayerCardUpdateActionsMode(false)).toBe('readonly');
  });
});
