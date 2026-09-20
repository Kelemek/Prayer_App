import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { ForceUpgradeComponent } from './force-upgrade.component';
import { ClientVersionGateService } from '../../services/client-version-gate.service';
import {
  ANDROID_PLAY_STORE_URL,
  FORCE_UPGRADE_REFRESH_BODY,
  FORCE_UPGRADE_STORE_BODY,
} from '../../../lib/client-version-gate';

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
      upgradeKind: 'refresh' as const,
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
    vi.stubGlobal('location', {
      origin: 'https://prayerapp.romans8.net',
      hostname: 'prayerapp.romans8.net',
      reload: vi.fn(),
    });

    await render(ForceUpgradeComponent, {
      providers: [{ provide: ClientVersionGateService, useValue: gate }],
    });

    expect(screen.getByRole('heading', { name: 'Update required' })).toBeTruthy();
    expect(screen.getByText(FORCE_UPGRADE_REFRESH_BODY)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Refresh this page' })
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hard refresh' })).toBeNull();
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      'client_upgrade_required',
      expect.objectContaining({
        surface: 'web',
        upgrade_kind: 'refresh',
        client_version: '1.0',
        min_version: '2.0',
      })
    );
  });

  it('opens the store on native binary block', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');

    await render(ForceUpgradeComponent, {
      providers: [
        {
          provide: ClientVersionGateService,
          useValue: {
            getDecision: () => ({
              blocked: true,
              upgradeKind: 'store' as const,
              surface: 'native' as const,
              clientVersion: '1.0',
              minVersion: '2.0',
            }),
          },
        },
      ],
    });

    expect(screen.getByText(FORCE_UPGRADE_STORE_BODY)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update the app' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hard refresh' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Update the app' }));
    expect(Browser.open).toHaveBeenCalledWith({ url: ANDROID_PLAY_STORE_URL });
  });
});
