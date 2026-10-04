import { Injectable } from '@angular/core';
import { driver, type Config, type Driver, type DriveStep, type DriverHook } from 'driver.js';
import type { AdminHelpTourHighlightStep } from '../lib/admin-help-tour-prepare';
import { ADMIN_HELP_TOUR_TIMING } from '../lib/admin-help-tour-timing';
import { HelpDriverTourChain } from '../lib/help-driver-tour-chain';
import {
  resolveAdminHelpTourPopoverSide,
  scrollForAdminHelpTourPopover,
  type AdminHelpTourPopoverVerticalSide,
} from '../lib/admin-help-tour-popover-placement';

export interface AdminHighlightTourCopy {
  title: string;
  description: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminHelpDriverTourService {
  private activeDriver: Driver | null = null;
  private introChainActive = false;
  private onIntroChainEnded: (() => void) | null = null;

  private readonly tourChain = new HelpDriverTourChain({
    onDriverTeardown: () => {
      this.activeDriver = null;
    },
    onChainedTourUserAbort: () => this.endIntroChainIfActive(),
    onChainedTourAbortedWithoutCallback: () => this.endIntroChainIfActive(),
  });

  interruptTours(): void {
    this.introChainActive = false;
    this.onIntroChainEnded = null;
    this.destroy();
  }

  queueTourFinishedCallback(fn: (() => void) | null): void {
    this.tourChain.queueTourFinishedCallback(fn);
  }

  beginIntroChain(onEnded: () => void): void {
    this.introChainActive = true;
    this.onIntroChainEnded = onEnded;
  }

  isIntroChainActive(): boolean {
    return this.introChainActive;
  }

  endIntroChainIfActive(): void {
    if (!this.introChainActive) {
      return;
    }
    this.introChainActive = false;
    const cb = this.onIntroChainEnded;
    this.onIntroChainEnded = null;
    cb?.();
  }

  startFullGuidedTourWelcome(onBegin: () => void, onDismiss: () => void, opts?: { totalSteps: number }): void {
    if (typeof document === 'undefined') {
      return;
    }
    this.destroy();
    this.tourChain.beginWelcomeChain(onBegin);

    const dismissWelcome = (): void => {
      this.tourChain.clearWelcomeChain();
      onDismiss();
    };

    const d = this.startTourDriver({
      showProgress: opts?.totalSteps != null && opts.totalSteps >= 2,
      showButtons: ['next', 'close'],
      smoothScroll: true,
      allowClose: true,
      popoverClass: 'help-driver-popover',
      onDestroyStarted: (_element, _step, opts) => {
        dismissWelcome();
        opts.driver.destroy();
      },
      steps: [
        {
          popover: {
            title: 'Welcome to Admin',
            description:
              'This <strong>guided tour</strong> walks through <strong>Settings</strong> top to bottom — Analytics, Content, Email, Tools, Security, and Integrations when available. <strong>Close</strong>, the dimmed overlay, or <strong>Escape</strong> ends the <em>entire</em> tour.<br><br>Tap <strong>Begin</strong> when you are ready.',
            side: 'bottom',
            align: 'center',
            nextBtnText: 'Begin',
            onNextClick: (_element, _step, opts) => {
              opts.driver.destroy();
            },
            onCloseClick: (_element, _step, opts) => {
              dismissWelcome();
              opts.driver.destroy();
            },
          },
        },
      ],
    });
    d.drive(0);
  }

  startFullGuidedTourClosing(onClosed: () => void): void {
    if (typeof document === 'undefined') {
      return;
    }
    this.destroy();
    const d = this.startTourDriver({
      showProgress: false,
      showButtons: ['next', 'close'],
      doneBtnText: 'Close',
      smoothScroll: true,
      allowClose: true,
      popoverClass: 'help-driver-popover',
      onDestroyed: () => {
        onClosed();
      },
      steps: [
        {
          popover: {
            title: 'You are all set',
            description:
              'You have toured the main Admin Settings areas. Use the <strong>?</strong> button any time for searchable help or to replay a single section with <strong>Show me</strong>.',
            side: 'bottom',
            align: 'center',
          },
        },
      ],
    });
    d.drive(0);
  }

  startHighlightTour(
    copy: AdminHighlightTourCopy,
    highlightSteps: readonly AdminHelpTourHighlightStep[]
  ): void {
    if (typeof document === 'undefined') {
      return;
    }
    // Keep queued intro-chain callbacks; full destroy() clears them before the prior driver tears down.
    this.killActiveDriver();

    const steps: DriveStep[] = [];
    for (const step of highlightSteps) {
      const el = document.getElementById(step.elementId);
      if (el) {
        const preferredVertical = normalizePopoverVerticalSide(step.popoverSide);
        const side = preferredVertical
          ? resolveAdminHelpTourPopoverSide(el, preferredVertical)
          : (step.popoverSide ?? 'bottom');
        steps.push({
          element: el,
          popover: {
            title: step.title ?? copy.title,
            description: step.description ?? copy.description,
            side,
            align: step.popoverAlign ?? 'start',
          },
          onHighlightStarted: (element, _driveStep, { driver: drv }) => {
            if (!(element instanceof HTMLElement)) {
              return;
            }
            const vertical = normalizePopoverVerticalSide(_driveStep.popover?.side);
            if (vertical) {
              scrollForAdminHelpTourPopover(element, vertical);
            }
            schedulePopoverReposition(drv);
          },
          onHighlighted: (_element, _driveStep, { driver: drv }) => {
            schedulePopoverReposition(drv);
          },
        });
      }
    }
    if (steps.length === 0) {
      steps.push({
        popover: {
          title: copy.title,
          description: copy.description,
          side: 'bottom',
          align: 'center',
        },
      });
    }

    const d = this.startTourDriver({
      showProgress: steps.length > 1,
      showButtons: ['previous', 'next', 'close'],
      smoothScroll: false,
      allowClose: true,
      popoverClass: 'help-driver-popover',
      popoverOffset: 14,
      stagePadding: 8,
      steps: steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        if (!isLast || !step.popover) {
          return step;
        }
        return {
          ...step,
          popover: {
            ...step.popover,
            onNextClick: this.popoverNextKillsTour(),
          },
        };
      }),
    });
    d.drive(0);
  }

  destroy(): void {
    this.tourChain.reset();
    this.tourChain.killActiveDriver(this.activeDriver);
    this.activeDriver = null;
  }

  private popoverNextKillsTour(): DriverHook {
    return () => {
      this.killActiveDriver();
    };
  }

  private killActiveDriver(): void {
    this.tourChain.killActiveDriver(this.activeDriver);
    this.activeDriver = null;
  }

  private startTourDriver(config: Config): Driver {
    const d = driver(this.tourChain.wrapDriverConfig(config));
    this.activeDriver = d;
    return d;
  }

  static readonly prepareSettleMs = ADMIN_HELP_TOUR_TIMING.driverStartSettleMs;
}

function normalizePopoverVerticalSide(
  side: AdminHelpTourHighlightStep['popoverSide'] | undefined
): AdminHelpTourPopoverVerticalSide | null {
  if (side === 'top' || side === 'bottom') {
    return side;
  }
  return null;
}

function schedulePopoverReposition(drv: Driver): void {
  window.requestAnimationFrame(() => {
    drv.refresh();
    window.setTimeout(() => drv.refresh(), 120);
    window.setTimeout(() => drv.refresh(), 320);
  });
}
