import { describe, it, expect } from 'vitest';
import {
  getPersonalCategoryColorPickerViewportBounds,
  shouldOpenPersonalCategoryColorPickerUp,
  computePersonalCategoryColorPickerPosition,
  computePersonalCategoryHeaderPickerPosition,
  isNodeInsidePersonalCategoryPickerDropdown,
  shouldDismissPersonalCategoryPickerOnScroll,
  PERSONAL_CATEGORY_COLOR_PICKER_ESTIMATED_WIDTH,
} from './personal-category-picker-placement';

describe('personalCategoryPickerPlacement', () => {
  describe('shouldOpenPersonalCategoryColorPickerUp', () => {
    it('opens downward when there is room below', () => {
      expect(
        shouldOpenPersonalCategoryColorPickerUp(100, 130, 200, 800, 0)
      ).toBe(false);
    });

    it('opens upward when near the bottom of the viewport', () => {
      expect(
        shouldOpenPersonalCategoryColorPickerUp(900, 930, 200, 950, 0)
      ).toBe(true);
    });

    it('prefers the side with more space when both are tight', () => {
      expect(
        shouldOpenPersonalCategoryColorPickerUp(200, 230, 400, 300, 0)
      ).toBe(true);
    });

    it('accounts for a sticky header via viewportTop', () => {
      expect(
        shouldOpenPersonalCategoryColorPickerUp(350, 380, 200, 400, 80)
      ).toBe(true);
    });
  });

  describe('getPersonalCategoryColorPickerViewportBounds', () => {
    it('uses the safe-area scroll container when present', () => {
      const viewport = document.createElement('div');
      viewport.className = 'safe-area-viewport';
      viewport.getBoundingClientRect = () =>
        ({
          top: 48,
          bottom: 900,
          left: 0,
          right: 1200,
          width: 1200,
          height: 852,
          x: 0,
          y: 48,
          toJSON: () => ({}),
        }) as DOMRect;
      document.body.appendChild(viewport);

      const anchor = document.createElement('button');
      viewport.appendChild(anchor);

      const bounds = getPersonalCategoryColorPickerViewportBounds(anchor);
      expect(bounds).toEqual({ top: 48, bottom: 900, width: 1200 });

      viewport.remove();
    });
  });

  describe('computePersonalCategoryColorPickerPosition', () => {
    it('clamps horizontally so the picker stays on screen', () => {
      const position = computePersonalCategoryColorPickerPosition(
        { top: 100, bottom: 130, left: 1100, width: 80 },
        { width: 280, height: 260 },
        { top: 0, bottom: 800, width: 1200 }
      );

      expect(position.leftPx).toBe(912);
    });

    it('centers on the pill when there is enough horizontal room', () => {
      const position = computePersonalCategoryColorPickerPosition(
        { top: 100, bottom: 130, left: 400, width: 80 },
        { width: 280, height: 260 },
        { top: 0, bottom: 800, width: 1200 }
      );

      expect(position.leftPx).toBe(300);
      expect(position.openUp).toBe(false);
    });
  });

  describe('computePersonalCategoryHeaderPickerPosition', () => {
    it('places the popover below and left-aligned to the category pill', () => {
      const position = computePersonalCategoryHeaderPickerPosition(
        { top: 100, bottom: 136, left: 24 },
        200,
        { top: 0, bottom: 800 }
      );

      expect(position.openUp).toBe(false);
      expect(position.topPx).toBe(140);
      expect(position.leftPx).toBe(24);
    });

    it('opens upward when there is not enough room below', () => {
      const position = computePersonalCategoryHeaderPickerPosition(
        { top: 900, bottom: 936, left: 16 },
        200,
        { top: 0, bottom: 950 }
      );

      expect(position.openUp).toBe(true);
      expect(position.topPx).toBe(696);
      expect(position.leftPx).toBe(16);
    });
  });

  describe('shouldDismissPersonalCategoryPickerOnScroll', () => {
    it('dismisses when the pill is fully above the viewport', () => {
      expect(
        shouldDismissPersonalCategoryPickerOnScroll(
          { top: 10, bottom: 40 },
          { top: 100, bottom: 800 }
        )
      ).toBe(true);
    });

    it('keeps open when the pill still intersects the viewport', () => {
      expect(
        shouldDismissPersonalCategoryPickerOnScroll(
          { top: 200, bottom: 230 },
          { top: 0, bottom: 800 }
        )
      ).toBe(false);
    });
  });

  describe('isNodeInsidePersonalCategoryPickerDropdown', () => {
    it('returns true for nodes inside the dropdown', () => {
      const dropdown = document.createElement('div');
      const child = document.createElement('button');
      dropdown.appendChild(child);
      expect(isNodeInsidePersonalCategoryPickerDropdown(child, dropdown)).toBe(
        true
      );
    });
  });
});
