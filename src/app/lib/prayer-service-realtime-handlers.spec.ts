import { describe, expect, it, vi } from 'vitest';
import { buildPrayerCatalogRealtimeHandlers } from './prayer-service-realtime-handlers';

describe('prayer-service-realtime-handlers', () => {
  it('reloads community prayers on prayer table change', async () => {
    const reloadCommunityPrayers = vi.fn().mockResolvedValue(undefined);
    const handlers = buildPrayerCatalogRealtimeHandlers({
      reloadCommunityPrayers,
      reloadPersonalPrayers: vi.fn(),
    });

    handlers.onPrayersChange({
      eventType: 'INSERT',
      old: {},
      new: { id: 'p1', status: 'current' },
    });

    await Promise.resolve();
    expect(reloadCommunityPrayers).toHaveBeenCalled();
  });

  it('skips personal reload for display-order-only updates', () => {
    const reloadPersonalPrayers = vi.fn().mockResolvedValue(undefined);
    const handlers = buildPrayerCatalogRealtimeHandlers({
      reloadCommunityPrayers: vi.fn(),
      reloadPersonalPrayers,
    });

    handlers.onPersonalPrayersChange({
      eventType: 'UPDATE',
      old: { id: 'p1', display_order: 1, title: 't' },
      new: { id: 'p1', display_order: 2, title: 't' },
    });

    expect(reloadPersonalPrayers).not.toHaveBeenCalled();
  });

  it('asks the caller to drop the channel when the socket closes', () => {
    const onDisconnected = vi.fn();
    const handlers = buildPrayerCatalogRealtimeHandlers({
      reloadCommunityPrayers: vi.fn(),
      reloadPersonalPrayers: vi.fn(),
      onDisconnected,
    });

    handlers.onSubscribeStatus?.('CLOSED');
    handlers.onSubscribeStatus?.('SUBSCRIBED');

    expect(onDisconnected).toHaveBeenCalledTimes(1);
  });

  it('reloads community prayers on prayer update changes', async () => {
    const reloadCommunityPrayers = vi.fn().mockResolvedValue(undefined);
    const handlers = buildPrayerCatalogRealtimeHandlers({
      reloadCommunityPrayers,
      reloadPersonalPrayers: vi.fn(),
    });
    handlers.onPrayerUpdatesChange({ eventType: 'INSERT', old: {}, new: {} });
    await Promise.resolve();
    expect(reloadCommunityPrayers).toHaveBeenCalled();
  });

  it('reloads personal prayers when payload warrants it', async () => {
    const reloadPersonalPrayers = vi.fn().mockResolvedValue(undefined);
    const handlers = buildPrayerCatalogRealtimeHandlers({
      reloadCommunityPrayers: vi.fn(),
      reloadPersonalPrayers,
    });
    handlers.onPersonalPrayersChange({
      eventType: 'INSERT',
      old: {},
      new: { id: 'p1', title: 'Prayer' },
    });
    await Promise.resolve();
    expect(reloadPersonalPrayers).toHaveBeenCalled();
  });

  it('drops reminders when community prayers are removed or answered', () => {
    const dropRemindersForPrayer = vi.fn();
    const handlers = buildPrayerCatalogRealtimeHandlers({
      reloadCommunityPrayers: vi.fn().mockResolvedValue(undefined),
      reloadPersonalPrayers: vi.fn(),
      dropRemindersForPrayer,
    });
    handlers.onPrayersChange({
      eventType: 'DELETE',
      old: { id: 'p1' },
      new: {},
    });
    expect(dropRemindersForPrayer).toHaveBeenCalledWith('p1', 'community');
  });

  it('drops personal reminders and logs reload failures', async () => {
    const dropRemindersForPrayer = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handlers = buildPrayerCatalogRealtimeHandlers({
      reloadCommunityPrayers: vi.fn().mockRejectedValue(new Error('boom')),
      reloadPersonalPrayers: vi.fn().mockRejectedValue(new Error('boom')),
      dropRemindersForPrayer,
    });
    handlers.onPersonalPrayersChange({
      eventType: 'DELETE',
      old: { id: 'pp1' },
      new: {},
    });
    handlers.onPrayersChange({
      eventType: 'INSERT',
      old: {},
      new: { id: 'p1', status: 'current' },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(dropRemindersForPrayer).toHaveBeenCalledWith('pp1', 'personal');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
