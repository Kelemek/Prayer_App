import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveAdminHelpTourPopoverSide,
  scrollForAdminHelpTourPopover,
} from './admin-help-tour-popover-placement';

describe('resolveAdminHelpTourPopoverSide', () => {
  let el: HTMLDivElement;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  });

  afterEach(() => {
    el.remove();
  });

  it('prefers bottom when there is space below', () => {
    el.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 300,
        left: 0,
        right: 100,
        width: 100,
        height: 200,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;

    expect(resolveAdminHelpTourPopoverSide(el, 'bottom')).toBe('bottom');
  });

  it('uses top when bottom has no room', () => {
    el.getBoundingClientRect = () =>
      ({
        top: 520,
        bottom: 780,
        left: 0,
        right: 100,
        width: 100,
        height: 260,
        x: 0,
        y: 520,
        toJSON: () => ({}),
      }) as DOMRect;

    expect(resolveAdminHelpTourPopoverSide(el, 'bottom')).toBe('top');
  });
});

describe('scrollForAdminHelpTourPopover', () => {
  it('scrolls down when popover needs room below', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () =>
      ({
        top: 500,
        bottom: 790,
        left: 0,
        right: 10,
        width: 10,
        height: 290,
        x: 0,
        y: 500,
        toJSON: () => ({}),
      }) as DOMRect;
    const scrollBy = vi.fn();
    vi.stubGlobal('scrollBy', scrollBy);
    scrollForAdminHelpTourPopover(el, 'bottom', 260);
    expect(scrollBy).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
