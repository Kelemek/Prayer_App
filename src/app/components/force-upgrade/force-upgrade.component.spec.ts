import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { ForceUpgradeComponent } from './force-upgrade.component';
import { ClientVersionGateService } from '../../services/client-version-gate.service';
import { ANDROID_PLAY_STORE_URL } from '../../../lib/client-version-gate';

const capturePostHogEvent = vi.fn();

const UPGRADE_BODY =
  'This version of Prayer App is no longer supported. Please update from the App Store or Google Play to keep using the app.';

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

    expect(screen.getByRole('heading', { name: 'Update required' })).toBeTruthy();
    expect(screen.getByText(UPGRADE_BODY)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Refresh this page' })
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hard refresh' })).toBeNull();
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      'client_upgrade_required',
      expect.objectContaining({
        surface: 'web',
        client_version: '1.0',
        min_version: '2.0',
      })
    );
  });

  it('opens the store on native', async () => {
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

    expect(screen.getByText(UPGRADE_BODY)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update the app' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hard refresh' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Update the app' }));
    expect(Browser.open).toHaveBeenCalledWith({ url: ANDROID_PLAY_STORE_URL });
  });
});
