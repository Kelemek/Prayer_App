import { Injectable } from '@angular/core';
import { firstValueFrom, take } from 'rxjs';
import type { HelpSection } from '../types/help-content';
import { AdminHelpDriverTourService } from './admin-help-driver-tour.service';
import { HelpContentService } from './help-content.service';
import { dispatchAdminHelpSectionTour } from '../lib/admin-help-tour-dispatch';
import { filterAdminIntroTourSections } from '../lib/admin-intro-tour-sections';
import type { AdminHelpTourHost } from './admin-help-tour-host.adapter';
import { AdminHelpTourSettingsTabState } from './admin-help-tour-settings-tab-state.service';
import { ADMIN_HELP_TOUR_TIMING } from '../lib/admin-help-tour-timing';

@Injectable()
export class AdminHelpTourLauncher {
  private host: AdminHelpTourHost | null = null;
  private markIntroSeenOnEnd: (() => void) | null = null;

  constructor(
    private readonly adminHelpDriverTourService: AdminHelpDriverTourService,
    private readonly helpContentService: HelpContentService,
    private readonly settingsTabState: AdminHelpTourSettingsTabState
  ) {}

  bindHost(host: AdminHelpTourHost): void {
    this.host = host;
  }

  setMarkIntroSeenHandler(handler: (() => void) | null): void {
    this.markIntroSeenOnEnd = handler;
  }

  startSectionTour(section: HelpSection): void {
    const host = this.host;
    if (!host) {
      return;
    }
    this.adminHelpDriverTourService.interruptTours();
    this.settingsTabState.reset();
    host.resetTourPrepareState();
    host.closeHelp();
    host.markForCheck();
    window.setTimeout(() => this.dispatchSectionTour(section), ADMIN_HELP_TOUR_TIMING.launcherStartDelayMs);
  }

  startIntroGuidedTour(sections: HelpSection[]): void {
    const host = this.host;
    if (!host) {
      return;
    }
    const ctx = host.getVisibilityContext();
    const sorted = filterAdminIntroTourSections(sections, ctx);
    if (sorted.length === 0) {
      this.markIntroSeenOnEnd?.();
      return;
    }
    this.adminHelpDriverTourService.interruptTours();
    this.settingsTabState.reset();
    host.resetTourPrepareState();
    this.adminHelpDriverTourService.beginIntroChain(() => this.markIntroSeenOnEnd?.());
    host.closeHelp();
    host.markForCheck();
    const totalSteps = 2 + sorted.length;
    window.setTimeout(() => {
      this.adminHelpDriverTourService.startFullGuidedTourWelcome(
        () => {
          window.setTimeout(() => this.runIntroStep(sorted, 0), 0);
        },
        () => this.finishIntroChain(),
        { totalSteps }
      );
    }, ADMIN_HELP_TOUR_TIMING.launcherStartDelayMs);
  }

  tryAutoStartIntroTour(): void {
    const host = this.host;
    if (!host) {
      return;
    }
    void firstValueFrom(this.helpContentService.getAdminSections().pipe(take(1))).then(
      (sections) => {
        this.startIntroGuidedTour(sections);
      }
    );
  }

  private finishIntroChain(): void {
    this.adminHelpDriverTourService.endIntroChainIfActive();
  }

  private runIntroStep(sections: HelpSection[], index: number): void {
    if (index >= sections.length) {
      window.setTimeout(() => {
        this.adminHelpDriverTourService.startFullGuidedTourClosing(() => this.finishIntroChain());
      }, ADMIN_HELP_TOUR_TIMING.introStepGapMs);
      return;
    }
    const section = sections[index];
    const advance = () => this.runIntroStep(sections, index + 1);
    this.adminHelpDriverTourService.queueTourFinishedCallback(advance);
    const host = this.host;
    if (!host) {
      return;
    }
    host.markForCheck();
    window.setTimeout(() => {
      if (!this.dispatchSectionTour(section)) {
        this.adminHelpDriverTourService.queueTourFinishedCallback(null);
        window.setTimeout(advance, 0);
      }
    }, ADMIN_HELP_TOUR_TIMING.launcherStartDelayMs);
  }

  private dispatchSectionTour(section: HelpSection): boolean {
    const host = this.host;
    if (!host) {
      return false;
    }
    return dispatchAdminHelpSectionTour(section, {
      host,
      adminHelpDriverTourService: this.adminHelpDriverTourService,
      settingsTabState: this.settingsTabState,
    });
  }
}
