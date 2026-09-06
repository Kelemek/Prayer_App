import { describe, expect, it, vi } from 'vitest';
import { runPersonalPrayerOrderRpcPerCategory } from './prayer-personal-order-rpc';
import type { PrayerRequest } from './prayer-types';

function prayer(id: string, categoryId: string | null): PrayerRequest {
  return {
    id,
    category_id: categoryId,
    category: categoryId ? 'Named' : null,
    title: id,
    description: '',
    status: 'active',
    requester: 'r',
    date_requested: '',
    created_at: '',
    updated_at: '',
    updates: [],
  };
}

describe('prayer-personal-order-rpc', () => {
  it('returns ok when rpc succeeds for each category', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const result = await runPersonalPrayerOrderRpcPerCategory(
      [prayer('p1', 'cat-a'), prayer('p2', 'cat-b')],
      rpc
    );
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith({
      p_category_id: 'cat-a',
      p_ordered_prayer_ids: ['p1'],
    });
  });

  it('returns a message when rpc errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('rpc fail') });
    const result = await runPersonalPrayerOrderRpcPerCategory(
      [prayer('p1', 'cat-a')],
      rpc
    );
    expect(result).toEqual({ ok: false, message: 'rpc fail' });
  });
});
