import { describe, it, expect, vi } from 'vitest';
import { PresentationHelpTourHostAdapter } from './presentation-help-tour-host.adapter';

describe('PresentationHelpTourHostAdapter', () => {
  it('proxies page state and callbacks', () => {
    const page = { showControls: false, showSettings: true };
    const markForCheck = vi.fn();
    const exitPresentation = vi.fn();
    const cancelControlsInitialTimer = vi.fn();
    const adapter = new PresentationHelpTourHostAdapter(page, {
      markForCheck,
      exitPresentation,
      cancelControlsInitialTimer,
    });

    expect(adapter.showControls).toBe(false);
    expect(adapter.showSettings).toBe(true);
    adapter.showControls = true;
    adapter.showSettings = false;
    expect(page.showControls).toBe(true);
    expect(page.showSettings).toBe(false);

    adapter.markForCheck();
    adapter.exitPresentation();
    adapter.cancelControlsInitialTimer();
    expect(markForCheck).toHaveBeenCalled();
    expect(exitPresentation).toHaveBeenCalled();
    expect(cancelControlsInitialTimer).toHaveBeenCalled();
  });
});
