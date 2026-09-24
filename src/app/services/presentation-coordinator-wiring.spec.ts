import { describe, it, expect, vi } from 'vitest';
import { wirePresentationControllers } from './presentation-coordinator-wiring';

describe('wirePresentationControllers', () => {
  it('binds playback, timer, controls, and help tour hosts', () => {
    const page = {
      currentIndex: 0,
      loop: false,
      smartMode: false,
      displayDuration: 10,
      showSettings: false,
      showTimerNotification: false,
      items: [],
      currentItem: undefined,
      showControls: true,
      initialPeriodElapsed: false,
    };
    const cdr = { markForCheck: vi.fn(), detectChanges: vi.fn() };
    const playback = {
      bindHost: vi.fn(),
      nextSlide: vi.fn(),
      previousSlide: vi.fn(),
      togglePlay: vi.fn(),
    };
    const controlsInput = { cancelInitialAutoHideTimer: vi.fn() };
    const exitPresentation = vi.fn();

    const wired = wirePresentationControllers({
      page,
      cdr: cdr as never,
      playback: playback as never,
      controlsInput: controlsInput as never,
      exitPresentation,
    });

    expect(playback.bindHost).toHaveBeenCalled();
    wired.controlsInputHost.onNextSlide();
    wired.controlsInputHost.onPreviousSlide();
    wired.controlsInputHost.onTogglePlay();
    wired.controlsInputHost.onExitPresentation();
    wired.helpTourHost.markForCheck();
    wired.helpTourHost.cancelControlsInitialTimer();
    wired.helpTourHost.exitPresentation();
    wired.prayerTimerHost.closeSettings();
    wired.prayerTimerHost.detectChanges();
    expect(playback.nextSlide).toHaveBeenCalled();
    expect(exitPresentation).toHaveBeenCalled();
    expect(page.showSettings).toBe(false);
  });
});
