import type { AdminTab } from '../lib/admin-pending-queues';
import type { AdminSettingsTab } from '../lib/admin-settings-tabs';
import type { AdminHelpTourPrepare } from '../lib/admin-help-tour-prepare';
import type { AdminHelpTourVisibilityContext } from '../lib/admin-help-tour-visibility';
import { adminCollapsibleTourSectionId } from '../lib/admin-help-tour-anchors';
import {
  delayMs,
  isCollapsibleTriggerExpanded,
  waitForAdminSectionContentReady,
  waitForCondition,
  waitForElementById,
  waitForLayoutSettle,
} from '../lib/admin-help-tour-expand';
import { ADMIN_HELP_TOUR_TIMING } from '../lib/admin-help-tour-timing';

export interface AdminHelpTourHost {
  closeHelp(): void;
  markForCheck(): void;
  getVisibilityContext(): AdminHelpTourVisibilityContext;
  prepareForTour(prepare: AdminHelpTourPrepare): Promise<void>;
  resetTourPrepareState(): void;
  setMainTab(tab: AdminTab): void;
  setSettingsTab(tab: AdminSettingsTab): void;
  ensureSettingsLoaded(): Promise<void>;
}

export interface AdminHelpTourHostBindings {
  closeHelp(): void;
  markForCheck(): void;
  getVisibilityContext(): AdminHelpTourVisibilityContext;
  setMainTab(tab: AdminTab): void;
  setSettingsTab(tab: AdminSettingsTab): void;
  ensureSettingsLoaded(): Promise<void>;
  /** Run change detection after programmatic expand clicks (lazy settings panel). */
  flushView?: () => void;
}

export class AdminHelpTourHostAdapter implements AdminHelpTourHost {
  private lastExpandedTriggerIds: readonly string[] = [];

  constructor(private readonly bindings: AdminHelpTourHostBindings) {}

  resetTourPrepareState(): void {
    this.lastExpandedTriggerIds = [];
  }

  closeHelp(): void {
    this.bindings.closeHelp();
  }

  markForCheck(): void {
    this.bindings.markForCheck();
  }

  getVisibilityContext(): AdminHelpTourVisibilityContext {
    return this.bindings.getVisibilityContext();
  }

  setMainTab(tab: AdminTab): void {
    this.bindings.setMainTab(tab);
  }

  setSettingsTab(tab: AdminSettingsTab): void {
    this.bindings.setSettingsTab(tab);
  }

  ensureSettingsLoaded(): Promise<void> {
    return this.bindings.ensureSettingsLoaded();
  }

  async prepareForTour(prepare: AdminHelpTourPrepare): Promise<void> {
    await this.collapseExpandedTriggers(this.lastExpandedTriggerIds);
    this.lastExpandedTriggerIds = prepare.expandTriggerIds ?? [];

    this.setMainTab(prepare.mainTab);
    if (prepare.settingsTab) {
      await this.ensureSettingsLoaded();
      this.setSettingsTab(prepare.settingsTab);
      this.markForCheck();
      this.bindings.flushView?.();
      await delayMs(ADMIN_HELP_TOUR_TIMING.host.settingsTabSettleMs);
    }

    const willExpand = (prepare.expandTriggerIds?.length ?? 0) > 0;
    if (prepare.expandTriggerIds?.length) {
      for (const triggerId of prepare.expandTriggerIds) {
        await this.expandCollapsibleTrigger(triggerId);
        const sectionId = adminCollapsibleTourSectionId(triggerId);
        await waitForAdminSectionContentReady(
          sectionId,
          ADMIN_HELP_TOUR_TIMING.host.sectionContentTimeoutMs
        );
      }
      this.markForCheck();
      this.bindings.flushView?.();
      await delayMs(ADMIN_HELP_TOUR_TIMING.host.preparePaintAfterExpandMs);
      await waitForLayoutSettle();
    } else {
      this.markForCheck();
      await delayMs(ADMIN_HELP_TOUR_TIMING.host.preparePaintMs);
    }

    for (const step of prepare.highlightSteps) {
      await waitForAdminSectionContentReady(
        step.elementId,
        ADMIN_HELP_TOUR_TIMING.host.sectionContentTimeoutMs
      );
    }

    if (willExpand) {
      await delayMs(ADMIN_HELP_TOUR_TIMING.host.highlightSettleAfterExpandMs);
    }
  }

  private async collapseExpandedTriggers(triggerIds: readonly string[]): Promise<void> {
    if (triggerIds.length === 0) {
      return;
    }
    let collapsedAny = false;
    for (const triggerId of triggerIds) {
      const trigger = document.getElementById(triggerId);
      if (trigger && isCollapsibleTriggerExpanded(trigger)) {
        trigger.click();
        collapsedAny = true;
      }
    }
    if (!collapsedAny) {
      return;
    }
    this.markForCheck();
    this.bindings.flushView?.();
    await delayMs(ADMIN_HELP_TOUR_TIMING.host.collapseSettleMs);
    await waitForLayoutSettle();
  }

  private async expandCollapsibleTrigger(triggerId: string): Promise<void> {
    const trigger = await waitForElementById(triggerId);
    if (!trigger) {
      return;
    }
    if (isCollapsibleTriggerExpanded(trigger)) {
      return;
    }
    trigger.click();
    this.markForCheck();
    this.bindings.flushView?.();
    await waitForCondition(
      () => {
        const el = document.getElementById(triggerId);
        return el != null && isCollapsibleTriggerExpanded(el);
      },
      ADMIN_HELP_TOUR_TIMING.host.expandOpenTimeoutMs
    );
  }
}
