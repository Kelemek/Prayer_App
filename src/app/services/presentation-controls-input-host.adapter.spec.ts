import { describe, it, expect, vi } from 'vitest';
import { PresentationControlsInputHostAdapter } from './presentation-controls-input-host.adapter';

describe('PresentationControlsInputHostAdapter', () => {
  it('proxies state and forwards control callbacks', () => {
    const page = { showControls: false, initialPeriodElapsed: false };
    const callbacks = {
      onNextSlide: vi.fn(),
      onPreviousSlide: vi.fn(),
      onTogglePlay: vi.fn(),
      onExitPresentation: vi.fn(),
    };
    const adapter = new PresentationControlsInputHostAdapter(page, callbacks);

    adapter.showControls = true;
    adapter.initialPeriodElapsed = true;
    expect(page.showControls).toBe(true);
    expect(page.initialPeriodElapsed).toBe(true);

    adapter.onNextSlide();
    adapter.onPreviousSlide();
    adapter.onTogglePlay();
    adapter.onExitPresentation();
    expect(callbacks.onNextSlide).toHaveBeenCalled();
    expect(callbacks.onPreviousSlide).toHaveBeenCalled();
    expect(callbacks.onTogglePlay).toHaveBeenCalled();
    expect(callbacks.onExitPresentation).toHaveBeenCalled();
  });
});
