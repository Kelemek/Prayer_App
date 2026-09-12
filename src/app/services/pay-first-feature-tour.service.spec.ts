import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PayFirstFeatureTourService } from './pay-first-feature-tour.service';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

vi.mock('driver.js', () => {
  const drive = vi.fn();
  const destroy = vi.fn();
  return {
    driver: vi.fn(() => ({ drive, destroy })),
  };
});

import { Capacitor } from '@capacitor/core';
import { driver } from 'driver.js';

describe('PayFirstFeatureTourService', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    document.body.innerHTML = `
      <button id="tour-filter-add-church"></button>
      <div data-church-demo-panel></div>
      <button id="tour-filter-add-group"></button>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('starts a church tour without price copy and uses Continue on web', () => {
    const service = new PayFirstFeatureTourService();
    const host = {
      setFilter: vi.fn(),
      openUserSettings: vi.fn(),
      markForCheck: vi.fn(),
    };
    service.startChurchTour(host, vi.fn());
    expect(host.setFilter).toHaveBeenCalledWith('current');
    expect(driver).toHaveBeenCalled();
    const config = vi.mocked(driver).mock.calls.at(-1)?.[0] as {
      steps: Array<{ popover?: { description?: string; doneBtnText?: string } }>;
    };
    const blob = JSON.stringify(config.steps);
    expect(blob).not.toMatch(/\$|Buy|Stripe|checkout/i);
    expect(config.steps.at(-1)?.popover?.doneBtnText).toBe('Continue');
  });

  it('uses Email me a link on native last step', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const service = new PayFirstFeatureTourService();
    service.startProTour(
      { setFilter: vi.fn(), openUserSettings: vi.fn(), markForCheck: vi.fn() },
      vi.fn()
    );
    const config = vi.mocked(driver).mock.calls.at(-1)?.[0] as {
      steps: Array<{ popover?: { doneBtnText?: string; description?: string } }>;
    };
    expect(config.steps.at(-1)?.popover?.doneBtnText).toBe('Email me a link to set up');
    expect(config.steps.at(-1)?.popover?.description).not.toMatch(/\$|Buy|Stripe/i);
  });

  it('uses group limits in Pro tour copy without prices', () => {
    const service = new PayFirstFeatureTourService();
    service.startProTour(
      { setFilter: vi.fn(), openUserSettings: vi.fn(), markForCheck: vi.fn() },
      vi.fn(),
      { max_groups_owned: 1, max_members_per_group: 5 }
    );
    const config = vi.mocked(driver).mock.calls.at(-1)?.[0] as {
      steps: Array<{ popover?: { description?: string } }>;
    };
    const blob = JSON.stringify(config.steps);
    expect(blob).toContain('1 group');
    expect(blob).toContain('5 members');
    expect(blob).not.toMatch(/\$|Buy|Stripe|checkout/i);
  });
});
