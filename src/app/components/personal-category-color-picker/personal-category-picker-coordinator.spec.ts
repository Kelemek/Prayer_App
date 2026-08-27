import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  activatePersonalCategoryPicker,
  deactivatePersonalCategoryPicker,
  resetPersonalCategoryPickerCoordinatorForTests,
} from './personal-category-picker-coordinator';

describe('personalCategoryPickerCoordinator', () => {
  beforeEach(() => {
    resetPersonalCategoryPickerCoordinatorForTests();
  });

  it('closes the previously active picker when another opens', () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();

    activatePersonalCategoryPicker(firstClose);
    activatePersonalCategoryPicker(secondClose);

    expect(firstClose).toHaveBeenCalledTimes(1);
    expect(secondClose).not.toHaveBeenCalled();
  });

  it('does not close the same picker again after it was dismissed', () => {
    const close = vi.fn();

    activatePersonalCategoryPicker(close);
    deactivatePersonalCategoryPicker(close);
    activatePersonalCategoryPicker(close);

    expect(close).not.toHaveBeenCalled();
  });
});
