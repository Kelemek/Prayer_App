import { describe, expect, it, vi } from 'vitest';
import { markUserSettingsAllItemsAsRead } from './user-settings-badge-mark-read';

describe('markUserSettingsAllItemsAsRead', () => {
  it('delegates to badge service', () => {
    const badgeService = { markAllCachedItemsAsRead: vi.fn() };
    markUserSettingsAllItemsAsRead(badgeService as never);
    expect(badgeService.markAllCachedItemsAsRead).toHaveBeenCalled();
  });

  it('swallows errors from badge service', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const badgeService = {
      markAllCachedItemsAsRead: vi.fn(() => {
        throw new Error('fail');
      }),
    };
    markUserSettingsAllItemsAsRead(badgeService as never);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
