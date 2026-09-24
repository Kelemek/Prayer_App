import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  startAppSettingsTour,
  startCreatingPrayersTour,
  startFilteringTour,
  startMemorizeTour,
  startPersonalPrayersTour,
  startPrayerEncouragementTour,
  startPrayerPromptsTour,
  startPresentationModeTour,
  startSearchPrayersTour,
  startPrayerRemindersTour,
  startEmailSubscriptionTour,
  startPrintingTour,
  startFeedbackTour,
} from './home-help-tour-section-starts';

describe('home-help-tour-section-starts', () => {
  const section = { title: 'T', description: 'D' };
  let host: Record<string, ReturnType<typeof vi.fn>>;
  let helpDriverTourService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    host = {
      getActiveFilter: vi.fn(() => 'current'),
      openPrayerForm: vi.fn(),
      closePrayerForm: vi.fn(),
      setFilter: vi.fn(),
      markForCheck: vi.fn(),
      getPromptsCount: vi.fn(() => 1),
      clearSelectedPromptTypes: vi.fn(),
      getCurrentPrayers: vi.fn().mockResolvedValue([{ id: 'p1' }]),
      closeHelp: vi.fn(),
      openSearchPanel: vi.fn(),
      getPrayerFormHooks: vi.fn(() => ({})),
      getMemorizedItemsCount: vi.fn(() => 2),
      openUserSettings: vi.fn(),
      closeUserSettings: vi.fn(),
      stashPresentationTourSession: vi.fn(),
      navigateToPresentation: vi.fn(),
      hasSessionEmail: vi.fn(() => true),
      getWalkthroughPersonalPrayer: vi.fn(() => null),
      openWalkthroughPersonalEdit: vi.fn(),
      closeWalkthroughPersonalEdit: vi.fn(),
      clickWalkthroughAddUpdate: vi.fn(),
      narrowToWalkthroughCategoryFilter: vi.fn(),
      deleteWalkthroughTestPrayer: vi.fn(),
    };
    helpDriverTourService = {
      startCreatingPrayersHelpSectionTour: vi.fn(),
      startFilteringHelpSectionTour: vi.fn(),
      startPrayerPromptsTour: vi.fn(),
      startPrayerEncouragementTour: vi.fn(),
      startSearchPrayersTour: vi.fn(),
      startPersonalPrayersHelpSectionTour: vi.fn(),
      startMemorizeHelpSectionTour: vi.fn(),
      startAppSettingsHelpSectionTour: vi.fn(),
      startPresentationModePrayButtonPreludeTour: vi.fn(),
      startPrayerRemindersHelpSectionTour: vi.fn(),
      startEmailSubscriptionHelpSectionTour: vi.fn(),
      startPrintingHelpSectionTour: vi.fn(),
      startFeedbackHelpSectionTour: vi.fn(),
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const ctx = () => ({
    host: host as never,
    helpDriverTourService: helpDriverTourService as never,
  });

  it('startCreatingPrayersTour wires host callbacks', () => {
    startCreatingPrayersTour(section, ctx());
    expect(helpDriverTourService.startCreatingPrayersHelpSectionTour).toHaveBeenCalled();
    const hooks = helpDriverTourService.startCreatingPrayersHelpSectionTour.mock.calls[0]![1];
    hooks.openPrayerForm();
    hooks.closePrayerForm();
    hooks.switchToCurrent();
    expect(host.openPrayerForm).toHaveBeenCalled();
    expect(host.closePrayerForm).toHaveBeenCalled();
    expect(host.setFilter).toHaveBeenCalledWith('current');
  });

  it('startCreatingPrayersTour omits anonymous step on personal filter', () => {
    host.getActiveFilter = vi.fn(() => 'personal');
    startCreatingPrayersTour(section, ctx());
    expect(
      helpDriverTourService.startCreatingPrayersHelpSectionTour.mock.calls[0]![2]
    ).toEqual({ includeAnonymousUpdateStep: false });
  });

  it('startFilteringTour switches filters', () => {
    startFilteringTour(section, ctx());
    const hooks = helpDriverTourService.startFilteringHelpSectionTour.mock.calls[0]![1];
    hooks.switchToCurrent();
    hooks.switchToAnswered();
    hooks.switchToTotal();
    hooks.switchToPrompts();
    hooks.switchToPersonal();
    expect(host.setFilter).toHaveBeenCalledWith('personal');
    expect(host.setFilter).toHaveBeenCalledWith('answered');
  });

  it('startPrayerPromptsTour passes hasPrompts', () => {
    startPrayerPromptsTour(section, ctx());
    expect(helpDriverTourService.startPrayerPromptsTour).toHaveBeenCalledWith(
      expect.anything(),
      { hasPrompts: true },
      expect.anything()
    );
    const hooks = helpDriverTourService.startPrayerPromptsTour.mock.calls[0]![2];
    hooks.switchToPrompts();
    hooks.clearPromptTypes();
    expect(host.clearSelectedPromptTypes).toHaveBeenCalled();
  });

  it('startPrayerEncouragementTour waits then starts tour', async () => {
    const promise = startPrayerEncouragementTour(section, ctx());
    await vi.advanceTimersByTimeAsync(80);
    await promise;
    expect(helpDriverTourService.startPrayerEncouragementTour).toHaveBeenCalled();
    const hooks =
      helpDriverTourService.startPrayerEncouragementTour.mock.calls[0]![2];
    hooks.switchToCurrent();
    expect(host.setFilter).toHaveBeenCalledWith('current');
  });

  it('startSearchPrayersTour opens search after delay', () => {
    startSearchPrayersTour(section, ctx());
    vi.advanceTimersByTime(280);
    expect(host.openSearchPanel).toHaveBeenCalled();
    expect(helpDriverTourService.startSearchPrayersTour).toHaveBeenCalled();
  });

  it('startPersonalPrayersTour registers walkthrough hooks', () => {
    const form = {
      fillWalkthroughPrayerFor: vi.fn(),
      fillWalkthroughDescription: vi.fn(),
      ensureWalkthroughPersonalSelected: vi.fn(),
      fillWalkthroughCategory: vi.fn(),
      submitWalkthroughPrayerForm: vi.fn(),
    };
    host.getPrayerFormHooks = vi.fn(() => form);
    host.getWalkthroughPersonalPrayer = vi.fn(() => ({ id: 'wp1' }));
    startPersonalPrayersTour(section, ctx());
    const hooks =
      helpDriverTourService.startPersonalPrayersHelpSectionTour.mock.calls[0]![1];
    hooks.switchToPersonalFilter();
    hooks.openPrayerForm();
    hooks.markForCheck();
    hooks.fillWalkthroughPrayerFor();
    hooks.fillWalkthroughDescription();
    hooks.ensureWalkthroughPersonalSelected();
    hooks.fillWalkthroughCategory();
    hooks.submitWalkthroughPrayerForm();
    hooks.openWalkthroughPersonalEdit();
    hooks.closeWalkthroughPersonalEdit();
    hooks.clickWalkthroughAddUpdate();
    hooks.narrowToWalkthroughCategoryFilter();
    hooks.deleteWalkthroughTestPrayer();
    form.fillWalkthroughPrayerFor();
    expect(host.openWalkthroughPersonalEdit).toHaveBeenCalledWith({ id: 'wp1' });
    expect(helpDriverTourService.startPersonalPrayersHelpSectionTour).toHaveBeenCalled();
  });

  it('startMemorizeTour passes memorized count', () => {
    startMemorizeTour(section, ctx());
    expect(helpDriverTourService.startMemorizeHelpSectionTour).toHaveBeenCalledWith(
      expect.anything(),
      { hasMemorizedItems: true },
      expect.anything()
    );
    const hooks = helpDriverTourService.startMemorizeHelpSectionTour.mock.calls[0]![2];
    hooks.switchToMemorize();
    expect(host.setFilter).toHaveBeenCalledWith('memorize');
  });

  it('startAppSettingsTour opens settings via hooks', () => {
    startAppSettingsTour(section, ctx());
    const hooks = helpDriverTourService.startAppSettingsHelpSectionTour.mock.calls[0]![1];
    hooks.openSettings();
    hooks.closeSettings();
    hooks.markForCheck();
    expect(host.openUserSettings).toHaveBeenCalled();
    expect(host.closeUserSettings).toHaveBeenCalled();
  });

  it('startPresentationModeTour navigates to presentation', () => {
    startPresentationModeTour(section, ctx());
    const hooks =
      helpDriverTourService.startPresentationModePrayButtonPreludeTour.mock.calls[0]![1];
    hooks.continueToPresentation();
    hooks.markForCheck();
    expect(host.navigateToPresentation).toHaveBeenCalled();
    expect(host.stashPresentationTourSession).toHaveBeenCalled();
  });

  it('startPrayerRemindersTour loads prayers when email is present', async () => {
    const promise = startPrayerRemindersTour(section, ctx());
    await vi.advanceTimersByTimeAsync(80);
    await promise;
    expect(helpDriverTourService.startPrayerRemindersHelpSectionTour).toHaveBeenCalled();
  });

  it('startPrayerRemindersTour skips prayer list without session email', async () => {
    host.hasSessionEmail = vi.fn(() => false);
    const promise = startPrayerRemindersTour(section, ctx());
    await vi.advanceTimersByTimeAsync(80);
    await promise;
    expect(host.getCurrentPrayers).not.toHaveBeenCalled();
    expect(helpDriverTourService.startPrayerRemindersHelpSectionTour).toHaveBeenCalled();
  });

  it('startPrayerRemindersTour wires settings hooks', async () => {
    const promise = startPrayerRemindersTour(section, ctx());
    await vi.advanceTimersByTimeAsync(80);
    await promise;
    const hooks =
      helpDriverTourService.startPrayerRemindersHelpSectionTour.mock.calls[0]![1];
    hooks.openSettings();
    hooks.closeSettings();
    hooks.markForCheck();
    expect(host.openUserSettings).toHaveBeenCalled();
  });

  it('startEmailSubscriptionTour and printing/feedback use settings hooks', () => {
    startEmailSubscriptionTour(section, ctx());
    startPrintingTour(section, ctx());
    startFeedbackTour(section, ctx());
    expect(helpDriverTourService.startEmailSubscriptionHelpSectionTour).toHaveBeenCalled();
    expect(helpDriverTourService.startPrintingHelpSectionTour).toHaveBeenCalled();
    expect(helpDriverTourService.startFeedbackHelpSectionTour).toHaveBeenCalled();
  });
});
