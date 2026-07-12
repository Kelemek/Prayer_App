import { describe, it, expect } from 'vitest';
import {
  memorizeStickyHeaderVisibleTop,
  memorizeWordModeVisibleBottom,
  scrollMemorizeBlankNearestInPracticeColumn,
  scrollMemorizeBlankIntoPracticeColumn,
} from './memorizationScrollIntoPractice';

function mockScrollParent(overrides: Partial<HTMLElement> = {}) {
  const el = {
    scrollTop: 100,
    scrollHeight: 1000,
    clientHeight: 400,
    getBoundingClientRect: () => ({
      top: 0,
      bottom: 400,
      left: 0,
      right: 300,
      width: 300,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
    ...overrides,
  } as HTMLElement;
  return el;
}

function mockTarget(rect: { top: number; bottom: number; height?: number }) {
  const height = rect.height ?? rect.bottom - rect.top;
  return {
    getBoundingClientRect: () => ({
      top: rect.top,
      bottom: rect.bottom,
      left: 0,
      right: 100,
      width: 100,
      height,
      x: 0,
      y: rect.top,
      toJSON: () => ({}),
    }),
  } as HTMLElement;
}

describe('memorizeStickyHeaderVisibleTop', () => {
  it('uses scroll top when sticky header is absent', () => {
    expect(memorizeStickyHeaderVisibleTop(100, null, 12)).toBe(112);
  });

  it('keeps the blank below a sticky first-letters header', () => {
    expect(memorizeStickyHeaderVisibleTop(100, 220, 12)).toBe(232);
  });

  it('does not raise the top when the sticky header is above the scroll top', () => {
    expect(memorizeStickyHeaderVisibleTop(100, 80, 12)).toBe(112);
  });
});

describe('memorizeWordModeVisibleBottom', () => {
  it('uses scroll bottom when word-choice footer is absent', () => {
    expect(memorizeWordModeVisibleBottom(400, null, 12, 16)).toBe(388);
  });

  it('keeps a gap above a taller multi-row word-choice footer', () => {
    // Footer top sits at 280 while scroll bottom is 400 (footer grew into the column).
    expect(memorizeWordModeVisibleBottom(400, 280, 12, 16)).toBe(252);
  });

  it('still reserves gap when footer top aligns with scroll bottom', () => {
    expect(memorizeWordModeVisibleBottom(400, 400, 12, 16)).toBe(372);
  });
});

describe('scrollMemorizeBlankNearestInPracticeColumn', () => {
  it('scrolls up when element is above viewport', () => {
    const scrollEl = mockScrollParent({ scrollTop: 200 });
    const target = mockTarget({ top: -20, bottom: 10 });
    scrollMemorizeBlankNearestInPracticeColumn(scrollEl, target);
    expect(scrollEl.scrollTop).toBeLessThan(200);
  });

  it('scrolls down when element is below viewport', () => {
    const scrollEl = mockScrollParent({ scrollTop: 100 });
    const target = mockTarget({ top: 390, bottom: 420 });
    scrollMemorizeBlankNearestInPracticeColumn(scrollEl, target);
    expect(scrollEl.scrollTop).toBeGreaterThan(100);
  });

  it('does not scroll when element is fully visible', () => {
    const scrollEl = mockScrollParent({ scrollTop: 100 });
    const target = mockTarget({ top: 50, bottom: 80 });
    scrollMemorizeBlankNearestInPracticeColumn(scrollEl, target);
    expect(scrollEl.scrollTop).toBe(100);
  });

  it('clamps scroll to max scroll', () => {
    const scrollEl = mockScrollParent({ scrollTop: 590 });
    const target = mockTarget({ top: 500, bottom: 900 });
    scrollMemorizeBlankNearestInPracticeColumn(scrollEl, target);
    expect(scrollEl.scrollTop).toBe(600);
  });

  it('clamps scroll to zero minimum', () => {
    const scrollEl = mockScrollParent({ scrollTop: 5 });
    const target = mockTarget({ top: -100, bottom: -50 });
    scrollMemorizeBlankNearestInPracticeColumn(scrollEl, target);
    expect(scrollEl.scrollTop).toBe(0);
  });
});

describe('scrollMemorizeBlankIntoPracticeColumn', () => {
  it('centers element in scroll parent', () => {
    const scrollEl = mockScrollParent({ scrollTop: 0 });
    const target = mockTarget({ top: 200, bottom: 220, height: 20 });
    scrollMemorizeBlankIntoPracticeColumn(scrollEl, target);
    expect(scrollEl.scrollTop).toBeGreaterThan(0);
    expect(scrollEl.scrollTop).toBeLessThanOrEqual(600);
  });

  it('clamps to max scroll when target is near bottom', () => {
    const scrollEl = mockScrollParent({ scrollTop: 0 });
    const target = mockTarget({ top: 900, bottom: 920, height: 20 });
    scrollMemorizeBlankIntoPracticeColumn(scrollEl, target);
    expect(scrollEl.scrollTop).toBe(600);
  });

  it('clamps to zero when centering would scroll above top', () => {
    const scrollEl = mockScrollParent({ scrollTop: 0 });
    const target = mockTarget({ top: 0, bottom: 20, height: 20 });
    scrollMemorizeBlankIntoPracticeColumn(scrollEl, target);
    expect(scrollEl.scrollTop).toBe(0);
  });
});
