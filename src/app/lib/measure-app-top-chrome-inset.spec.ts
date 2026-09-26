import { describe, expect, it } from 'vitest';
import {
  appTopChromeOverlayPaddingTop,
  measureAppTopChromeInsetPx,
} from './measure-app-top-chrome-inset';

describe('measureAppTopChromeInsetPx', () => {
  it('returns 0 (org switcher lives in Settings)', () => {
    expect(measureAppTopChromeInsetPx()).toBe(0);
  });

  it('returns null overlay padding when no top chrome is measured', () => {
    expect(appTopChromeOverlayPaddingTop()).toBeNull();
  });
});
