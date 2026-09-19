import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { merge } from 'rxjs';
import { BadgeService } from './badge.service';
import { TenantContextService } from './tenant-context.service';
import { UserSessionService } from './user-session.service';
import { SupabaseService } from './supabase.service';
import { CacheService } from './cache.service';
import {
  parseInAppBadgeReadState,
  promptsCacheKeyForTenant,
  scopedInAppBadgeReadCacheKey,
  shouldClearAppIconBadgeOnAppOpen,
  type InAppBadgeCachedItem,
} from '../lib/in-app-prayer-badge-count';
import {
  hydrateMissingTenantInAppBadgeCaches,
  type InAppBadgeReceiptRow,
} from '../lib/all-tenant-in-app-badge-hydrate';
import {
  fetchApprovedSharedPrayerUpdates,
  fetchApprovedSharedPrayers,
} from '../lib/prayer-community-db';
import {
  formatApprovedCommunityPrayersFromUpdatesMap,
  groupPrayerUpdatesByPrayerId,
} from '../lib/prayer-community-load';
import { sharedPrayersCacheKey } from '../lib/prayer-tenant';

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
 * Mirrors the all-tenant in-app prayer badge count onto the native app icon.
 * Web is a no-op. App open / resume never clears the badge.
 */
@Injectable({
  providedIn: 'root',
})
export class AppIconBadgeService {
  private native: AppIconBadgeNativeApi;
  private started = false;
  private hydrateInFlight: Promise<void> | null = null;
  private lastAppliedCount: number | null = null;

  constructor(
    private badgeService: BadgeService,
    private tenantContext: TenantContextService,
    private userSession: UserSessionService,
    private supabase: SupabaseService,
    private cache: CacheService
  ) {
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
      this.badgeService.getBadgeFunctionalityEnabled$(),
      this.tenantContext.memberships$,
      this.userSession.userSession$
    ).subscribe(() => {
      void this.sync();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Refresh the number from current in-app counts. Do not clear.
        void this.sync();
      }
    });

    void this.sync();
    void this.hydrateOtherTenantsAndSync();
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

  private async hydrateOtherTenantsAndSync(): Promise<void> {
    if (this.hydrateInFlight) {
      return this.hydrateInFlight;
    }
    this.hydrateInFlight = this.hydrateOtherTenants()
      .catch((error) => {
        console.warn('[AppIconBadge] Other-tenant hydrate failed:', error);
      })
      .then(() => {
        this.hydrateInFlight = null;
        return this.sync();
      });
    return this.hydrateInFlight;
  }

  private async hydrateOtherTenants(): Promise<void> {
    if (!this.native.isNativePlatform()) {
      return;
    }
    const email = (this.userSession.getUserEmail() ?? '').trim().toLowerCase();
    if (!email) {
      return;
    }

    const tenantIds = this.tenantContext
      .getMemberTenants()
      .map((tenant) => tenant.id)
      .filter(Boolean);
    const activeTenantId = this.tenantContext.getActiveTenant()?.id ?? null;

    await hydrateMissingTenantInAppBadgeCaches({
      tenantIds,
      skipTenantId: activeTenantId,
      email,
      hasPrayerCache: (tenantId) =>
        this.cache.hasData(sharedPrayersCacheKey(tenantId)),
      hasPromptCache: (tenantId) =>
        this.cache.hasData(promptsCacheKeyForTenant(tenantId)),
      readStoredReadState: (tenantId) =>
        parseInAppBadgeReadState(
          localStorage.getItem(scopedInAppBadgeReadCacheKey(tenantId, email))
        ),
      writeReadState: (tenantId, state) => {
        localStorage.setItem(
          scopedInAppBadgeReadCacheKey(tenantId, email),
          JSON.stringify(state)
        );
      },
      writePrayerCache: (tenantId, items) => {
        this.cache.set(sharedPrayersCacheKey(tenantId), items);
      },
      writePromptCache: (tenantId, items) => {
        this.cache.set(promptsCacheKeyForTenant(tenantId), items);
      },
      loadReceipts: (tenantId) => this.loadReceipts(tenantId, email),
      loadPrayers: (tenantId) => this.loadPrayers(tenantId),
      loadPrompts: (tenantId) => this.loadPrompts(tenantId),
    });
  }

  private async loadReceipts(
    tenantId: string,
    email: string
  ): Promise<InAppBadgeReceiptRow[]> {
    const { data, error } = await this.supabase.client.rpc(
      'get_badge_read_receipts',
      {
        p_tenant_id: tenantId,
        p_user_email: email,
      }
    );
    if (error) {
      throw error;
    }
    return (data || []) as InAppBadgeReceiptRow[];
  }

  private async loadPrayers(tenantId: string): Promise<InAppBadgeCachedItem[]> {
    const { prayersData, error } = await fetchApprovedSharedPrayers(
      this.supabase.client,
      {
        tenantId,
        useSuperAdminRpc: false,
        actorEmail: null,
      }
    );
    if (error) {
      throw error;
    }
    const prayerIds = (prayersData || []).map((p: { id?: string }) => p.id).filter(
      (id: string | undefined): id is string => !!id
    );
    const { updatesData, error: updatesError } =
      await fetchApprovedSharedPrayerUpdates(this.supabase.client, prayerIds, {
        tenantId,
        useSuperAdminRpc: false,
        actorEmail: null,
      });
    if (updatesError) {
      throw updatesError;
    }
    return formatApprovedCommunityPrayersFromUpdatesMap(
      prayersData || [],
      groupPrayerUpdatesByPrayerId(updatesData)
    );
  }

  private async loadPrompts(tenantId: string): Promise<InAppBadgeCachedItem[]> {
    const { data, error } = await this.supabase.client
      .from('prayer_prompts')
      .select('id, type, updated_at')
      .eq('tenant_id', tenantId);
    if (error) {
      throw error;
    }
    return (data || []) as InAppBadgeCachedItem[];
  }
}
