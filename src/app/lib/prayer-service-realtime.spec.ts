import { describe, expect, it, vi } from 'vitest';
import {
  communityPrayerReminderDropFromPayload,
  handlePrayerRealtimeSubscribeStatus,
  isRealtimeSubscriptionDisconnectedStatus,
  personalPrayerReminderDropFromPayload,
  shouldReloadPersonalPrayersAfterRealtimePayload,
} from './prayer-service-realtime';

describe('prayer-service-realtime', () => {
  it('treats CLOSED and CHANNEL_ERROR as disconnected', () => {
    expect(isRealtimeSubscriptionDisconnectedStatus('CLOSED')).toBe(true);
    expect(isRealtimeSubscriptionDisconnectedStatus('CHANNEL_ERROR')).toBe(true);
    expect(isRealtimeSubscriptionDisconnectedStatus('SUBSCRIBED')).toBe(false);
  });

  it('resubscribe hook runs only for disconnected statuses', () => {
    const onDisconnected = vi.fn();
    handlePrayerRealtimeSubscribeStatus('SUBSCRIBED', onDisconnected);
    expect(onDisconnected).not.toHaveBeenCalled();
    handlePrayerRealtimeSubscribeStatus('CLOSED', onDisconnected);
    handlePrayerRealtimeSubscribeStatus('CHANNEL_ERROR', onDisconnected);
    expect(onDisconnected).toHaveBeenCalledTimes(2);
  });

  it('drops community reminders on delete, archived, or answered', () => {
    expect(
      communityPrayerReminderDropFromPayload({
        eventType: 'DELETE',
        old: { id: 'p1' },
        new: {},
      })
    ).toEqual({ prayerId: 'p1', kind: 'community' });

    expect(
      communityPrayerReminderDropFromPayload({
        eventType: 'UPDATE',
        old: { id: 'p1', status: 'current' },
        new: { id: 'p1', status: 'answered' },
      })
    ).toEqual({ prayerId: 'p1', kind: 'community' });

    expect(
      communityPrayerReminderDropFromPayload({
        eventType: 'UPDATE',
        old: { id: 'p1', status: 'current' },
        new: { id: 'p1', status: 'current' },
      })
    ).toBeNull();
  });

  it('drops personal reminders on delete or Answered category', () => {
    expect(
      personalPrayerReminderDropFromPayload({
        eventType: 'DELETE',
        old: { id: 'pp1' },
        new: {},
      })
    ).toEqual({ prayerId: 'pp1', kind: 'personal' });

    expect(
      personalPrayerReminderDropFromPayload({
        eventType: 'UPDATE',
        old: { id: 'pp1', category: 'Family' },
        new: { id: 'pp1', category: 'Answered' },
      })
    ).toEqual({ prayerId: 'pp1', kind: 'personal' });
  });

  it('skips personal reload when UPDATE only changes display_order', () => {
    expect(
      shouldReloadPersonalPrayersAfterRealtimePayload({
        eventType: 'INSERT',
        old: {},
        new: { id: 'pp1' },
      })
    ).toBe(true);

    expect(
      shouldReloadPersonalPrayersAfterRealtimePayload({
        eventType: 'UPDATE',
        old: { id: 'pp1', display_order: 1001, title: 'Pray' },
        new: { id: 'pp1', display_order: 1002, title: 'Pray' },
      })
    ).toBe(false);

    expect(
      shouldReloadPersonalPrayersAfterRealtimePayload({
        eventType: 'UPDATE',
        old: { id: 'pp1', display_order: 1001, title: 'Pray' },
        new: { id: 'pp1', display_order: 1002, title: 'Changed' },
      })
    ).toBe(true);
  });
});
