import type { Config, Driver } from 'driver.js';

export type HelpDriverTourChainMode = 'off' | 'sectionAdvance' | 'welcome';

export interface HelpDriverTourChainHooks {
  /** After driver.js teardown (chain callback scheduling). */
  onDriverTeardown?: () => void;
  /** Home full guided tour: clear session handoff when a chained section ends without advancing. */
  onSectionAdvanceStopped?: () => void;
  /** Admin intro: user aborted overlay/close during a chained section. */
  onChainedTourUserAbort?: () => void;
  /** Admin intro: user aborted with no queued section callback. */
  onChainedTourAbortedWithoutCallback?: () => void;
}

export interface HelpDriverTourDestroyedOpts {
  config: Config;
  state: { activeIndex?: number };
}

/**
 * Shared driver.js tour chaining (welcome → sections → closing) for Home and Admin help tours.
 */
export class HelpDriverTourChain {
  private tourFinishedCallback: (() => void) | null = null;
  private tourChainMode: HelpDriverTourChainMode = 'off';
  private lastDriverDestroyWasProgrammatic = false;
  private tourAbortedFullChainByUser = false;

  constructor(private readonly hooks: HelpDriverTourChainHooks = {}) {}

  queueTourFinishedCallback(fn: (() => void) | null): void {
    this.tourFinishedCallback = fn;
    this.tourChainMode = fn ? 'sectionAdvance' : 'off';
  }

  beginWelcomeChain(onBegin: () => void): void {
    this.tourFinishedCallback = onBegin;
    this.tourChainMode = 'welcome';
  }

  clearWelcomeChain(): void {
    this.tourFinishedCallback = null;
    this.tourChainMode = 'off';
  }

  markProgrammaticDestroy(): void {
    this.lastDriverDestroyWasProgrammatic = true;
  }

  peekProgrammaticDestroyFlag(): boolean {
    return this.lastDriverDestroyWasProgrammatic;
  }

  reset(): void {
    this.tourFinishedCallback = null;
    this.tourChainMode = 'off';
    this.lastDriverDestroyWasProgrammatic = false;
    this.tourAbortedFullChainByUser = false;
  }

  wrapDriverConfig(config: Config): Config {
    const userOnDestroyed = config.onDestroyed;
    const userOnCloseClick = config.onCloseClick;
    const userOverlay = config.overlayClickBehavior;
    const chainSection = this.tourChainMode === 'sectionAdvance';
    const overlayClickBehavior: Config['overlayClickBehavior'] =
      chainSection && userOverlay !== 'nextStep'
        ? typeof userOverlay === 'function'
          ? (element, step, opts) => {
              this.tourAbortedFullChainByUser = true;
              userOverlay(element, step, opts);
            }
          : (_element, _step, opts) => {
              this.tourAbortedFullChainByUser = true;
              opts.driver.destroy();
            }
        : userOverlay;

    return {
      ...config,
      overlayClickBehavior,
      onCloseClick: (element, step, opts) => {
        if (chainSection) {
          this.tourAbortedFullChainByUser = true;
        }
        if (userOnCloseClick) {
          userOnCloseClick(element, step, opts);
        } else {
          opts.driver.destroy();
        }
      },
      onDestroyed: (element, step, opts) => {
        userOnDestroyed?.(element, step, opts);
        this.handleDestroyed(opts);
      },
    };
  }

  handleDestroyed(opts: HelpDriverTourDestroyedOpts): void {
    const mode = this.tourChainMode;
    const cb = this.tourFinishedCallback;
    const steps = opts.config.steps ?? [];
    const idx = opts.state.activeIndex;
    const onLastIndex =
      steps.length > 0 && typeof idx === 'number' && idx === steps.length - 1;
    const programmatic = this.lastDriverDestroyWasProgrammatic;
    this.lastDriverDestroyWasProgrammatic = false;

    let runCallback = false;
    if (cb) {
      if (mode === 'sectionAdvance') {
        const userAbort = this.tourAbortedFullChainByUser;
        this.tourAbortedFullChainByUser = false;
        if (programmatic) {
          runCallback = true;
        } else if (userAbort) {
          runCallback = false;
          this.hooks.onChainedTourUserAbort?.();
        } else {
          runCallback = onLastIndex;
        }
        if (!runCallback) {
          this.hooks.onSectionAdvanceStopped?.();
        }
      } else if (mode === 'welcome') {
        runCallback = true;
      } else {
        runCallback = true;
      }
    } else if (this.tourAbortedFullChainByUser) {
      this.tourAbortedFullChainByUser = false;
      this.hooks.onChainedTourAbortedWithoutCallback?.();
    }

    this.tourFinishedCallback = null;
    this.tourChainMode = 'off';

    if (runCallback && cb) {
      window.setTimeout(() => {
        try {
          cb();
        } catch {
          /* ignore */
        }
      }, 0);
    }

    this.hooks.onDriverTeardown?.();
  }

  killActiveDriver(activeDriver: Driver | null): void {
    if (activeDriver) {
      this.markProgrammaticDestroy();
      activeDriver.destroy();
    }
  }
}
