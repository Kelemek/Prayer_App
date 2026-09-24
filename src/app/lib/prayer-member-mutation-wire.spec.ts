import { describe, expect, it, vi } from 'vitest';
import {
  MEMBER_PRAYER_UPDATE_TOAST,
  runMemberPrayerCacheMutation,
} from './prayer-member-mutation-wire';

describe('runMemberPrayerCacheMutation', () => {
  it('returns true on success', async () => {
    const ok = await runMemberPrayerCacheMutation(
      vi.fn().mockResolvedValue(undefined),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      { success: 'ok', fail: 'no' },
      'log'
    );
    expect(ok).toBe(true);
  });

  it('returns false and reports error on failure', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reportError = vi.fn();
    const ok = await runMemberPrayerCacheMutation(
      vi.fn().mockRejectedValue(new Error('boom')),
      vi.fn(),
      vi.fn(),
      reportError,
      { success: 's', fail: MEMBER_PRAYER_UPDATE_TOAST.addFail },
      'member add'
    );
    expect(ok).toBe(false);
    expect(reportError).toHaveBeenCalledWith(MEMBER_PRAYER_UPDATE_TOAST.addFail);
    errSpy.mockRestore();
  });
});
