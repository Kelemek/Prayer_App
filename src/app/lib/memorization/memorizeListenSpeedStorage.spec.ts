import { describe, it, expect, beforeEach } from 'vitest';
import {
  MEMORIZE_LISTEN_SPEED_STORAGE_KEY,
  applyMemorizeListenPlaybackRateToMediaElement,
  formatMemorizeListenSpeedLabel,
  normalizeMemorizeListenSpeed,
  readMemorizeListenSpeedFromStorage,
  toMemorizeWebSpeechUtteranceRate,
  writeMemorizeListenSpeedToStorage,
} from './memorizeListenSpeedStorage';

describe('memorizeListenSpeedStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('formats speed labels', () => {
    expect(formatMemorizeListenSpeedLabel(1)).toBe('1x');
    expect(formatMemorizeListenSpeedLabel(1.5)).toBe('1.5x');
  });

  it('normalizes invalid storage values to 1x', () => {
    expect(normalizeMemorizeListenSpeed(null)).toBe(1);
    expect(normalizeMemorizeListenSpeed('2')).toBe(2);
    expect(normalizeMemorizeListenSpeed('9')).toBe(1);
  });

  it('reads and writes persisted speed', () => {
    writeMemorizeListenSpeedToStorage(1.25);
    expect(localStorage.getItem(MEMORIZE_LISTEN_SPEED_STORAGE_KEY)).toBe('1.25');
    expect(readMemorizeListenSpeedFromStorage()).toBe(1.25);
  });

  it('applies playback rate to media element', () => {
    const el = { playbackRate: 1 } as HTMLMediaElement;
    applyMemorizeListenPlaybackRateToMediaElement(el, 1.5);
    expect(el.playbackRate).toBe(1.5);
    applyMemorizeListenPlaybackRateToMediaElement(el, 0);
    expect(el.playbackRate).toBe(1.5);
  });

  it('scales web speech rate on iOS', () => {
    expect(toMemorizeWebSpeechUtteranceRate(1, true)).toBeLessThan(1);
    expect(toMemorizeWebSpeechUtteranceRate(2, false)).toBe(2);
  });
});
