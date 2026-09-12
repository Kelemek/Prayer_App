import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { driver, type DriveStep } from 'driver.js';
import { TOUR_SETTINGS_PRINT_ROW_ID } from './help-driver-tour.service';
import {
  payFirstTourDoneButtonText,
  type BillingSignupKind,
} from '../lib/billing-signup';
import type { UserGroupLimits } from '../types/platform-plan';

export interface PayFirstTourHost {
  setFilter(filter: 'current' | 'answered' | 'prompts' | 'groups'): void;
  openUserSettings(): void;
  markForCheck(): void;
}

@Injectable({
  providedIn: 'root',
})
export class PayFirstFeatureTourService {
  startChurchTour(host: PayFirstTourHost, onLastStep: () => void | Promise<void>): void {
    if (typeof document === 'undefined') {
      return;
    }
    host.setFilter('current');
    host.markForCheck();
    const isNative = Capacitor.isNativePlatform();
    const doneText = payFirstTourDoneButtonText(isNative);
    const steps: DriveStep[] = [];

    const addChurch = document.getElementById('tour-filter-add-church');
    if (addChurch) {
      steps.push({
        element: addChurch,
        popover: {
          title: 'Church for your congregation',
          description:
            'Start here to learn Church features or join with an invite. This tour is a preview — it does not create a church.',
          side: 'bottom',
          align: 'start',
        },
      });
    }

    const demo = document.querySelector('[data-church-demo-panel]');
    if (demo) {
      steps.push({
        element: demo,
        popover: {
          title: 'Shared prayer wall',
          description:
            'Church members share current and answered requests in one wall. Admins can moderate what the congregation sees.',
          side: 'bottom',
          align: 'center',
        },
      });
    } else {
      steps.push({
        popover: {
          title: 'Shared prayer wall',
          description:
            'After setup, your church gets a shared wall for current and answered prayers — not a personal-only list.',
          side: 'bottom',
          align: 'center',
        },
      });
    }

    steps.push({
      popover: {
        title: 'Moderation and branding',
        description:
          'Church admins review prayer updates, set branding, and print lists for gatherings. Those tools appear after you finish setup on the web.',
        side: 'bottom',
        align: 'center',
      },
    });

    const printRow = document.getElementById(TOUR_SETTINGS_PRINT_ROW_ID);
    if (printRow) {
      host.openUserSettings();
      host.markForCheck();
      steps.push({
        element: printRow,
        popover: {
          title: 'Print for gatherings',
          description:
            'Church plans can print prayer lists for services. Open Settings anytime to print personal lists today.',
          side: 'top',
          align: 'start',
        },
      });
    }

    steps.push(this.lastStep(doneText, isNative, 'church', onLastStep));
    this.drive(steps);
  }

  startProTour(
    host: PayFirstTourHost,
    onLastStep: () => void | Promise<void>,
    limits?: Pick<UserGroupLimits, 'max_groups_owned' | 'max_members_per_group'>
  ): void {
    if (typeof document === 'undefined') {
      return;
    }
    host.setFilter('groups');
    host.markForCheck();
    const isNative = Capacitor.isNativePlatform();
    const doneText = payFirstTourDoneButtonText(isNative);
    const steps: DriveStep[] = [];
    const maxGroups = limits?.max_groups_owned ?? 1;
    const maxMembers = limits?.max_members_per_group ?? 5;
    const groupWord = maxGroups === 1 ? 'group' : 'groups';
    const memberWord = maxMembers === 1 ? 'member' : 'members';
    const capsCopy = `Free accounts can create ${maxGroups} ${groupWord} with up to ${maxMembers} ${memberWord} each. Pro raises those caps so you can organize more circles.`;

    const addGroup = document.getElementById('tour-filter-add-group');
    if (addGroup) {
      steps.push({
        element: addGroup,
        popover: {
          title: 'More prayer groups',
          description: capsCopy,
          side: 'bottom',
          align: 'start',
        },
      });
    } else {
      steps.push({
        popover: {
          title: 'More prayer groups',
          description: capsCopy,
          side: 'bottom',
          align: 'center',
        },
      });
    }

    steps.push({
      popover: {
        title: 'Practice modes',
        description:
          'Pro also unlocks extra memorization practice modes so you can go deeper than the free set.',
        side: 'bottom',
        align: 'center',
      },
    });

    steps.push(this.lastStep(doneText, isNative, 'pro', onLastStep));
    this.drive(steps);
  }

  private lastStep(
    doneText: string,
    isNative: boolean,
    kind: BillingSignupKind,
    onLastStep: () => void | Promise<void>
  ): DriveStep {
    const churchCopy = isNative
      ? 'We will email you a link to finish Church setup on the web. Your personal app stays available.'
      : 'Continue to subscribe on the web, then name your church.';
    const proCopy = isNative
      ? 'We will email you a link to subscribe on the web. Nothing changes in the app until that finishes.'
      : 'Continue to subscribe on the web. You will land back in the app when it completes.';
    return {
      popover: {
        title: kind === 'church' ? 'Set up on the web' : 'Continue on the web',
        description: kind === 'church' ? churchCopy : proCopy,
        side: 'bottom',
        align: 'center',
        doneBtnText: doneText,
        onNextClick: (_el, _step, { driver: drv }) => {
          drv.destroy();
          void onLastStep();
        },
      },
    };
  }

  private drive(steps: DriveStep[]): void {
    const d = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      smoothScroll: true,
      allowClose: true,
      popoverClass: 'help-driver-popover',
      steps,
    });
    d.drive(0);
  }
}
