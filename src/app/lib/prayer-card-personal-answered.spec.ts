import { describe, expect, it, vi } from 'vitest';
import { applyPersonalPrayerCategoryUpdate } from './prayer-card-personal-answered';
import type { PrayerService } from '../services/prayer.service';

describe('applyPersonalPrayerCategoryUpdate', () => {
  it('returns null when update fails', async () => {
    const prayerService = {
      updatePersonalPrayer: vi.fn().mockResolvedValue(false),
    } as unknown as PrayerService;
    await expect(
      applyPersonalPrayerCategoryUpdate(prayerService, 'p1', 'Family')
    ).resolves.toBeNull();
  });

  it('maps Answered category to answered status', async () => {
    const prayerService = {
      updatePersonalPrayer: vi.fn().mockResolvedValue(true),
    } as unknown as PrayerService;
    await expect(
      applyPersonalPrayerCategoryUpdate(prayerService, 'p1', 'Answered')
    ).resolves.toEqual({ category: 'Answered', status: 'answered' });
  });

  it('maps other categories to current status', async () => {
    const prayerService = {
      updatePersonalPrayer: vi.fn().mockResolvedValue(true),
    } as unknown as PrayerService;
    await expect(
      applyPersonalPrayerCategoryUpdate(prayerService, 'p1', 'Health')
    ).resolves.toEqual({ category: 'Health', status: 'current' });
  });
});
