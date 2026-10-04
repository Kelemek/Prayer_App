import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminHelpTourLauncher } from './admin-help-tour.launcher';
import { AdminHelpTourSettingsTabState } from './admin-help-tour-settings-tab-state.service';
import type { HelpSection } from '../types/help-content';
import type { AdminHelpTourHost } from './admin-help-tour-host.adapter';

function section(id: string): HelpSection {
  return {
    id,
    title: id,
    description: 'desc',
    icon: '',
    content: [],
    order: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
  };
}

describe('AdminHelpTourLauncher', () => {
  let launcher: AdminHelpTourLauncher;
  let driver: {
    interruptTours: ReturnType<typeof vi.fn>;
    beginIntroChain: ReturnType<typeof vi.fn>;
    startFullGuidedTourWelcome: ReturnType<typeof vi.fn>;
    queueTourFinishedCallback: ReturnType<typeof vi.fn>;
    startHighlightTour: ReturnType<typeof vi.fn>;
    endIntroChainIfActive: ReturnType<typeof vi.fn>;
  };
  let host: AdminHelpTourHost;

  beforeEach(() => {
    driver = {
      interruptTours: vi.fn(),
      beginIntroChain: vi.fn(),
      startFullGuidedTourWelcome: vi.fn(),
      queueTourFinishedCallback: vi.fn(),
      startHighlightTour: vi.fn(),
      endIntroChainIfActive: vi.fn(),
    };
    const helpContent = {
      getAdminSections: () => ({
        pipe: () => ({
          subscribe: (fn: (s: HelpSection[]) => void) => fn([]),
        }),
      }),
    };
    launcher = new AdminHelpTourLauncher(
      driver as never,
      helpContent as never,
      new AdminHelpTourSettingsTabState()
    );
    host = {
      closeHelp: vi.fn(),
      markForCheck: vi.fn(),
      getVisibilityContext: () => ({
        showAnalyticsTab: true,
        isChurchTenant: true,
        showFeedbackForm: false,
        pcoCredentialsConfigured: false,
        canWipeChurch: false,
      }),
      prepareForTour: vi.fn().mockResolvedValue(undefined),
      setMainTab: vi.fn(),
      setSettingsTab: vi.fn(),
      ensureSettingsLoaded: vi.fn().mockResolvedValue(undefined),
      resetTourPrepareState: vi.fn(),
    };
    launcher.bindHost(host);
    vi.spyOn(window, 'setTimeout').mockImplementation((fn: TimerHandler) => {
      if (typeof fn === 'function') {
        fn();
      }
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  it('does nothing when host is not bound', () => {
    const unbound = new AdminHelpTourLauncher(
      driver as never,
      {} as never,
      new AdminHelpTourSettingsTabState()
    );
    unbound.startSectionTour(section('admin_help_analytics'));
    expect(driver.interruptTours).not.toHaveBeenCalled();
  });

  it('marks intro seen when no sections qualify for the tour', () => {
    const markSeen = vi.fn();
    launcher.setMarkIntroSeenHandler(markSeen);
    launcher.startIntroGuidedTour([section('admin_help_tools_feedback')]);
    expect(markSeen).toHaveBeenCalled();
    expect(driver.beginIntroChain).not.toHaveBeenCalled();
  });

  it('starts intro welcome for filtered sections', () => {
    const markSeen = vi.fn();
    launcher.setMarkIntroSeenHandler(markSeen);
    launcher.startIntroGuidedTour([
      section('admin_help_analytics'),
      section('admin_help_tools_feedback'),
    ]);
    expect(driver.beginIntroChain).toHaveBeenCalled();
    expect(driver.startFullGuidedTourWelcome).toHaveBeenCalled();
    const onDismiss = driver.startFullGuidedTourWelcome.mock.calls[0][1] as () => void;
    onDismiss();
    expect(driver.endIntroChainIfActive).toHaveBeenCalled();
    const onChainEnded = driver.beginIntroChain.mock.calls[0][0] as () => void;
    onChainEnded();
    expect(markSeen).toHaveBeenCalled();
  });
});
