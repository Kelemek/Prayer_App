import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { merge } from 'rxjs';
import { BadgeService } from './badge.service';
import { shouldClearAppIconBadgeOnAppOpen } from '../lib/in-app-prayer-badge-count';

export interface AppIconBadgeNativeApi {
  isNativePlatform(): boolean;
  configure(options: { persist: boolean; autoClear: boolean }): Promise<void>;
  requestPermissions(): Promise<void>;
  set(count: number): Promise<void>;
}

async function loadCapawesomeBadge() {
  return import('@capawesome/capacitor-badge');
}

export function createCapawesomeAppIconBadgeNative(): AppIconBadgeNativeApi {
  return {
    isNativePlatform: () => Capacitor.isNativePlatform(),
    async configure(options) {
      const { Badge } = await loadCapawesomeBadge();
      const configure = (
        Badge as { configure?: (opts: typeof options) => Promise<void> }
      ).configure;
      if (typeof configure === 'function') {
        await configure(options);
      }
    },
    async requestPermissions() {
      const { Badge } = await loadCapawesomeBadge();
      if (typeof Badge.requestPermissions === 'function') {
        await Badge.requestPermissions();
      }
    },
    async set(count: number) {
      const { Badge } = await loadCapawesomeBadge();
      await Badge.set({ count });
    },
  };
}

/**
 * Native sink for the all-tenant in-app prayer badge count.
 * Web is a no-op. App open / resume never clears the badge.
 */
@Injectable({
  providedIn: 'root',
})
export class AppIconBadgeService {
  private native: AppIconBadgeNativeApi;
  private started = false;
  private lastAppliedCount: number | null = null;

  constructor(private badgeService: BadgeService) {
    this.native = createCapawesomeAppIconBadgeNative();
    void this.start();
  }

  /** Test seam so specs can inject a fake native API after construction. */
  setNativeApiForTests(nativeApi: AppIconBadgeNativeApi): void {
    this.native = nativeApi;
    this.started = false;
    this.lastAppliedCount = null;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    if (!this.native.isNativePlatform()) {
      return;
    }

    try {
      await this.native.configure({
        persist: true,
        autoClear: shouldClearAppIconBadgeOnAppOpen(),
      });
      await this.native.requestPermissions();
    } catch (error) {
      console.warn('[AppIconBadge] Failed to initialize native badge:', error);
    }

    merge(
      this.badgeService.getUpdateBadgesChanged$(),
      this.badgeService.getBadgeFunctionalityEnabled$()
    ).subscribe(() => {
      void this.sync();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.sync();
      }
    });

    void this.sync();
  }

  async sync(): Promise<void> {
    if (!this.native.isNativePlatform()) {
      return;
    }
    const count = this.badgeService.getAllTenantDisplayedBadgeCount();
    if (this.lastAppliedCount === count) {
      return;
    }
    try {
      await this.native.set(count);
      this.lastAppliedCount = count;
    } catch (error) {
      console.warn('[AppIconBadge] Failed to set native badge count:', error);
    }
  }
}
