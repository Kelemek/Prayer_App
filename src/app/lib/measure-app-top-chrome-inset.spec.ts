import { describe, expect, it, afterEach } from 'vitest';
import {
  appTopChromeOverlayPaddingTop,
  measureAppTopChromeInsetPx,
} from './measure-app-top-chrome-inset';

describe('measureAppTopChromeInsetPx', () => {
  afterEach(() => {
    document.querySelector('app-tenant-switcher-bar')?.remove();
  });

  it('returns 0 when tenant bar is absent', () => {
    expect(measureAppTopChromeInsetPx()).toBe(0);
  });

  it('returns rounded height of tenant switcher bar', () => {
    const bar = document.createElement('app-tenant-switcher-bar');
    bar.getBoundingClientRect = () =>
      ({
        height: 49.2,
        width: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(bar);
    expect(measureAppTopChromeInsetPx()).toBe(50);
    expect(appTopChromeOverlayPaddingTop()).toBe(
      'calc(env(safe-area-inset-top, 0px) + 50px + 0.75rem)'
    );
  });

  it('returns null overlay padding when tenant bar is absent', () => {
    expect(appTopChromeOverlayPaddingTop()).toBeNull();
  });
});
