import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { ForceUpgradeComponent } from './force-upgrade.component';
import { ClientVersionGateService } from '../../services/client-version-gate.service';
import { ANDROID_PLAY_STORE_URL } from '../../../lib/client-version-gate';

const capturePostHogEvent = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'web'),
    isNativePlatform: vi.fn(() => false),
  },
}));

vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../lib/posthog', () => ({
  capturePostHogEvent: (...args: unknown[]) => capturePostHogEvent(...args),
}));

describe('ForceUpgradeComponent', () => {
  const gate = {
    getDecision: () => ({
      blocked: true,
      surface: 'web' as const,
      clientVersion: '1.0',
      minVersion: '2.0',
    }),
  };

  beforeEach(() => {
    capturePostHogEvent.mockClear();
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Browser.open).mockClear();
  });

  it('shows a web refresh CTA and records the gate event', async () => {
    await render(ForceUpgradeComponent, {
      providers: [{ provide: ClientVersionGateService, useValue: gate }],
    });

    expect(screen.getByTestId('force-upgrade-gate')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Update required' })).toBeTruthy();
    expect(screen.getByTestId('force-upgrade-cta').textContent).toContain(
      'Refresh this page'
    );
    expect(screen.getByTestId('force-upgrade-hard-reload')).toBeTruthy();
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      'client_upgrade_required',
      expect.objectContaining({
        surface: 'web',
        client_version: '1.0',
        min_version: '2.0',
      })
    );
  });

  it('opens the store on native and hides hard refresh', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');

    await render(ForceUpgradeComponent, {
      providers: [
        {
          provide: ClientVersionGateService,
          useValue: {
            getDecision: () => ({
              blocked: true,
              surface: 'native' as const,
              clientVersion: '1.0',
              minVersion: '2.0',
            }),
          },
        },
      ],
    });

    expect(screen.getByTestId('force-upgrade-cta').textContent).toContain(
      'Update the app'
    );
    expect(screen.queryByTestId('force-upgrade-hard-reload')).toBeNull();

    await userEvent.click(screen.getByTestId('force-upgrade-cta'));
    expect(Browser.open).toHaveBeenCalledWith({ url: ANDROID_PLAY_STORE_URL });
  });
});
