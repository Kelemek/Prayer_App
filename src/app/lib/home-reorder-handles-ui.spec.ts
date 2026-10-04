import { describe, it, expect, vi } from 'vitest';
import { HomeReorderHandlesUi } from './home-reorder-handles-ui';

describe('HomeReorderHandlesUi', () => {
  it('toggles handle visibility and notifies', () => {
    const notify = vi.fn();
    const ui = new HomeReorderHandlesUi(notify);
    expect(ui.handlesVisible).toBe(false);
    ui.toggle();
    expect(ui.handlesVisible).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('resetHandles hides handles and notifies when visible', () => {
    const notify = vi.fn();
    const ui = new HomeReorderHandlesUi(notify);
    ui.toggle();
    const itemRef = ui.reorderOverflowItem();
    ui.resetHandles();
    expect(ui.handlesVisible).toBe(false);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(ui.reorderOverflowItem()).toBe(itemRef);
    expect(itemRef.label).toBe('Enable reorder');
  });

  it('resetHandles is a no-op when already hidden', () => {
    const notify = vi.fn();
    const ui = new HomeReorderHandlesUi(notify);
    ui.resetHandles();
    expect(notify).not.toHaveBeenCalled();
  });

  it('selects shell base class from handle visibility', () => {
    const ui = new HomeReorderHandlesUi();
    expect(ui.chipShellBaseClass('with-handle', 'no-handle')).toBe('no-handle');
    ui.toggle();
    expect(ui.chipShellBaseClass('with-handle', 'no-handle')).toBe('with-handle');
  });

  it('disables drag when handles are hidden or blocked', () => {
    const ui = new HomeReorderHandlesUi();
    expect(ui.isChipDragDisabled(false)).toBe(true);
    ui.toggle();
    expect(ui.isChipDragDisabled(false)).toBe(false);
    expect(ui.isChipDragDisabled(true)).toBe(true);
  });

  it('combines eligibility with handle visibility for drag-active', () => {
    const ui = new HomeReorderHandlesUi();
    expect(ui.isReorderActive(true)).toBe(false);
    ui.toggle();
    expect(ui.isReorderActive(true)).toBe(true);
    expect(ui.isReorderActive(false)).toBe(false);
  });

  it('returns null reorder menu when not eligible', () => {
    const ui = new HomeReorderHandlesUi();
    expect(ui.reorderMenuWhen(false)).toBeNull();
    expect(ui.reorderMenuWhen(true)?.id).toBe('reorder');
  });

  it('keeps a stable overflow item reference across toggles', () => {
    const ui = new HomeReorderHandlesUi();
    const first = ui.reorderOverflowItem();
    ui.toggle();
    expect(ui.reorderOverflowItem()).toBe(first);
    expect(first.label).toBe('Disable Reorder');
  });
});
