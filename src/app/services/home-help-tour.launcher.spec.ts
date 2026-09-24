import { describe, it, expect, beforeEach, vi } from "vitest";
import { of } from "rxjs";
import { HomeHelpTourLauncher } from "./home-help-tour.launcher";
import {
  FULL_GUIDED_TOUR_CLOSING_SENTINEL,
  FULL_GUIDED_TOUR_QUEUE_KEY,
} from "./help-driver-tour.service";
import type { HomeHelpTourHost } from "./home-help-tour-host.adapter";
import type { HelpSection } from "../types/help-content";

function makeSection(id: string): HelpSection {
  return {
    id,
    title: "Title",
    description: "Description",
    icon: "icon",
    content: [],
    order: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "test",
  };
}

describe("HomeHelpTourLauncher", () => {
  let launcher: HomeHelpTourLauncher;
  let helpDriverTourService: {
    startFilteringHelpSectionTour: ReturnType<typeof vi.fn>;
    startFullGuidedTourWelcome: ReturnType<typeof vi.fn>;
    startFullGuidedTourClosing: ReturnType<typeof vi.fn>;
    queueTourFinishedCallback: ReturnType<typeof vi.fn>;
    setFullGuidedTourProgress: ReturnType<typeof vi.fn>;
    startPresentationModePrayButtonPreludeTour: ReturnType<typeof vi.fn>;
  };
  let helpContentService: { getSections: ReturnType<typeof vi.fn> };
  let host: HomeHelpTourHost;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    helpDriverTourService = {
      startFilteringHelpSectionTour: vi.fn(),
      startFullGuidedTourWelcome: vi.fn(),
      startFullGuidedTourClosing: vi.fn(),
      queueTourFinishedCallback: vi.fn(),
      setFullGuidedTourProgress: vi.fn(),
      startPresentationModePrayButtonPreludeTour: vi.fn(),
    };
    helpContentService = {
      getSections: vi.fn(() => of([makeSection("help_filtering")])),
    };
    launcher = new HomeHelpTourLauncher(
      helpDriverTourService as any,
      helpContentService as any
    );
    host = {
      closeHelp: vi.fn(),
      markForCheck: vi.fn(),
      getActiveFilter: vi.fn(() => "current"),
      setFilter: vi.fn(),
      getPromptsCount: vi.fn(() => 0),
      getMemorizedItemsCount: vi.fn(() => 0),
      clearSelectedPromptTypes: vi.fn(),
      openPrayerForm: vi.fn(),
      closePrayerForm: vi.fn(),
      openUserSettings: vi.fn(),
      closeUserSettings: vi.fn(),
      openSearchPanel: vi.fn(),
      getPrayerFormHooks: vi.fn(() => null),
      getWalkthroughPersonalPrayer: vi.fn(),
      openWalkthroughPersonalEdit: vi.fn(),
      closeWalkthroughPersonalEdit: vi.fn(),
      clickWalkthroughAddUpdate: vi.fn(),
      narrowToWalkthroughCategoryFilter: vi.fn(),
      deleteWalkthroughTestPrayer: vi.fn(),
      getCurrentPrayers: vi.fn(async () => []),
      hasSessionEmail: vi.fn(() => false),
      navigateToPresentation: vi.fn(),
      stashPresentationTourSession: vi.fn(),
    };
    launcher.bindHost(host);
  });

  it("closes help and starts the matching section tour", () => {
    vi.useFakeTimers();
    launcher.startSectionTour(makeSection("help_filtering"));
    vi.advanceTimersByTime(280);
    expect(host.closeHelp).toHaveBeenCalled();
    expect(helpDriverTourService.startFilteringHelpSectionTour).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("starts the full guided tour welcome when sections exist", () => {
    vi.useFakeTimers();
    launcher.startFullGuidedTour([makeSection("help_filtering")]);
    vi.advanceTimersByTime(280);
    expect(host.closeHelp).toHaveBeenCalled();
    expect(helpDriverTourService.startFullGuidedTourWelcome).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("no-ops when host is not bound", () => {
    const unbound = new HomeHelpTourLauncher(
      helpDriverTourService as any,
      helpContentService as any
    );
    unbound.startSectionTour(makeSection("help_filtering"));
    unbound.startFullGuidedTour([makeSection("help_filtering")]);
    expect(helpDriverTourService.startFullGuidedTourWelcome).not.toHaveBeenCalled();
  });

  it("tryResumeQueue starts closing tour from legacy sentinel", () => {
    vi.useFakeTimers();
    sessionStorage.setItem(
      FULL_GUIDED_TOUR_QUEUE_KEY,
      JSON.stringify([FULL_GUIDED_TOUR_CLOSING_SENTINEL])
    );
    launcher.tryResumeQueue();
    vi.runAllTimers();
    expect(helpDriverTourService.startFullGuidedTourClosing).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("tryResumeQueue resumes section queue from v1 payload", async () => {
    vi.useFakeTimers();
    sessionStorage.setItem(
      FULL_GUIDED_TOUR_QUEUE_KEY,
      JSON.stringify({
        v: 1,
        ids: ["help_filtering"],
        totalSteps: 4,
        resumeStartGlobalSectionIndex: 1,
      })
    );
    launcher.tryResumeQueue();
    await vi.runAllTimersAsync();
    expect(helpDriverTourService.setFullGuidedTourProgress).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("startFullGuidedTour no-ops when no active sections", () => {
    launcher.startFullGuidedTour([{ ...makeSection("help_filtering"), isActive: false }]);
    expect(helpDriverTourService.startFullGuidedTourWelcome).not.toHaveBeenCalled();
  });

  it("startSectionTour ignores unknown section ids", () => {
    vi.useFakeTimers();
    launcher.startSectionTour(makeSection("help_not_real"));
    vi.advanceTimersByTime(280);
    expect(helpDriverTourService.startFilteringHelpSectionTour).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("tryResumeQueue starts v1 closing tour", () => {
    vi.useFakeTimers();
    sessionStorage.setItem(
      FULL_GUIDED_TOUR_QUEUE_KEY,
      JSON.stringify({ v: 1, mode: "closing", totalSteps: 6 })
    );
    launcher.tryResumeQueue();
    vi.runAllTimers();
    expect(helpDriverTourService.startFullGuidedTourClosing).toHaveBeenCalledWith({
      totalSteps: 6,
    });
    vi.useRealTimers();
  });

  it("tryResumeQueue resumes legacy section id queue", async () => {
    vi.useFakeTimers();
    sessionStorage.setItem(
      FULL_GUIDED_TOUR_QUEUE_KEY,
      JSON.stringify(["help_filtering"])
    );
    launcher.tryResumeQueue();
    await vi.runAllTimersAsync();
    expect(helpDriverTourService.setFullGuidedTourProgress).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("full guided tour advances to closing after last section", () => {
    vi.useFakeTimers();
    helpDriverTourService.startFullGuidedTourWelcome.mockImplementation((cb) => cb());
    helpDriverTourService.queueTourFinishedCallback.mockImplementation((cb) => cb?.());
    launcher.startFullGuidedTour([makeSection("help_filtering")]);
    vi.runAllTimers();
    expect(helpDriverTourService.startFullGuidedTourClosing).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("runs presentation prelude when presentation section is in full tour", () => {
    vi.useFakeTimers();
    const presentation = makeSection("help_presentation");
    helpDriverTourService.startFullGuidedTourWelcome.mockImplementation((cb) => cb());
    helpDriverTourService.queueTourFinishedCallback.mockImplementation((cb) => cb?.());
    launcher.startFullGuidedTour([presentation]);
    vi.runAllTimers();
    expect(helpDriverTourService.startPresentationModePrayButtonPreludeTour).toHaveBeenCalled();
    expect(host.stashPresentationTourSession).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
