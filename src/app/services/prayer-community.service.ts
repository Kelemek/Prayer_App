import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';
import { EmailNotificationService } from './email-notification.service';
import { CacheService } from './cache.service';
import { BadgeService } from './badge.service';
import { TenantContextService } from './tenant-context.service';
import { ConnectivityService } from './connectivity.service';
import { PrayedForSyncService } from './prayed-for-sync.service';
import { resolveAuthorName } from '../utils/display-name';
import {
  formatApprovedCommunityPrayersFromUpdatesMap,
  formatPrayersByMonthFromSeparateUpdates,
  groupPrayerUpdatesByPrayerId,
  prayersByMonthIsoRange,
} from '../lib/prayer-community-load';
import {
  applyCommunityPrayerDeleteSnapshot,
  buildCommunityPrayerAdminNotificationPayload,
  buildCommunityPrayerInsertRow,
  buildCommunityPrayerStatusUpdatePayload,
  patchCommunityPrayerStatus,
  type CommunityUpdateSubmitData,
} from '../lib/prayer-community-mutations';
import {
  notifyPrayerDeletionRequestSubmitted,
  notifyUpdateDeletionRequestSubmitted,
  type PrayerDeletionRequestInput,
  type UpdateDeletionRequestInput,
} from '../lib/prayer-community-deletion-requests';
import {
  deleteCommunityPrayerRow,
  deleteCommunityPrayerUpdateRow,
  fetchApprovedSharedPrayerUpdates,
  fetchApprovedSharedPrayers,
  fetchCommunityPrayerTitle,
  fetchCommunityPrayerUpdatesByPrayerIds,
  fetchCommunityPrayersByMonth,
  fetchPrayerRowForDeletionNotify,
  fetchPrayerUpdateRowForDeletionNotify,
  findTenantMembershipByEmail,
  insertCommunityPrayerRowNoReturning,
  insertPendingCommunityPrayerUpdate,
  insertPendingCommunityUpdate,
  insertPrayerDeletionRequestRow,
  insertTenantMembershipMemberRow,
  insertUpdateDeletionRequestRow,
  updateCommunityPrayerStatusRow,
} from '../lib/prayer-community-db';
import {
  applyPrayerCatalogFilters,
  filterPrayerRequestsByStatusAndSearch,
} from '../lib/prayer-filter';
import {
  prayedForServerBaseline,
  seedPrayedForServerCounts,
  toPrayedForServerOnly,
  withPrayedForDisplayCounts,
} from '../lib/prayer-prayed-for-increment';
import { PRAYER_SERVICE_LOAD_ERROR_TOAST_COOLDOWN_MS } from '../lib/prayer-service-constants';
import {
  sharedPrayersCacheKeyForTenant,
  shouldUseSuperAdminTenantPrayerRpc,
} from '../lib/prayer-tenant';
import type {
  PrayerFilters,
  PrayerRequest,
  PrayerStatus,
} from '../lib/prayer-types';

export type PrayerCommunityFacadeHooks = {
  loadPrayers: (silentRefresh?: boolean) => Promise<void>;
  applyFilters: (filters: PrayerFilters) => void;
  getUserEmail: () => Promise<string | null>;
};

export class PrayerCommunityService {
  readonly allPrayersSubject = new BehaviorSubject<PrayerRequest[]>([]);
  readonly prayersSubject = new BehaviorSubject<PrayerRequest[]>([]);
  readonly loadingSubject = new BehaviorSubject<boolean>(true);
  readonly errorSubject = new BehaviorSubject<string | null>(null);
  currentFilters: PrayerFilters = {};
  lastLoadErrorToastTime = 0;
  private static readonly LOAD_ERROR_TOAST_COOLDOWN_MS =
    PRAYER_SERVICE_LOAD_ERROR_TOAST_COOLDOWN_MS;
  readonly communityServerPrayedFor = new Map<string, number>();

  readonly allPrayers$ = this.allPrayersSubject.asObservable();
  readonly prayers$ = this.prayersSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private emailNotification: EmailNotificationService,
    private cache: CacheService,
    private badgeService: BadgeService,
    private connectivity: ConnectivityService,
    private tenantContext: TenantContextService,
    private prayedForSync: PrayedForSyncService | null,
    private readonly facadeHooks: PrayerCommunityFacadeHooks
  ) {}

  getAllCommunityPrayersSnapshot(): PrayerRequest[] {
    return this.allPrayersSubject.value;
  }

  getActiveTenantId(): string | null {
    return this.tenantContext.getActiveTenant()?.id || null;
  }

  private shouldUseSuperAdminRpc(): boolean {
    return shouldUseSuperAdminTenantPrayerRpc({
      getIsSuperAdmin: () => this.tenantContext.getIsSuperAdmin?.() ?? false,
      getIsImpersonatingTenant: () =>
        this.tenantContext.getIsImpersonatingTenant?.() ?? false,
    });
  }

  getCachedSharedPrayers(
    tenantId: string | null | undefined
  ): PrayerRequest[] | null {
    const key = sharedPrayersCacheKeyForTenant(tenantId);
    if (!key) return null;
    return this.cache.get<PrayerRequest[]>(key);
  }

  getStaleSharedPrayers(
    tenantId: string | null | undefined
  ): PrayerRequest[] | null {
    const key = sharedPrayersCacheKeyForTenant(tenantId);
    if (!key) return null;
    return this.cache.getStale<PrayerRequest[]>(key);
  }

  setCachedSharedPrayers(
    tenantId: string | null | undefined,
    prayers: PrayerRequest[]
  ): void {
    const key = sharedPrayersCacheKeyForTenant(tenantId);
    if (!key) return;
    this.cache.set(key, prayers, 20 * 60 * 1000);
  }

  seedCommunityServerCounts(prayers: PrayerRequest[]): void {
    seedPrayedForServerCounts(this.communityServerPrayedFor, prayers);
  }

  private withCommunityDisplayCounts(prayers: PrayerRequest[]): PrayerRequest[] {
    return withPrayedForDisplayCounts(prayers, (id) =>
      this.displayCommunityPrayedForCount(id)
    );
  }

  toCommunityServerOnly(prayers: PrayerRequest[]): PrayerRequest[] {
    return toPrayedForServerOnly(prayers, this.communityServerPrayedFor);
  }

  private communityServerBaseline(prayerId: string): number {
    return prayedForServerBaseline(
      prayerId,
      this.communityServerPrayedFor,
      this.allPrayersSubject.value.find((p) => p.id === prayerId)
        ?.prayed_for_count ?? 0,
      this.prayedForSync?.getPendingCount(prayerId, 'community_prayer') ?? 0
    );
  }

  displayCommunityPrayedForCount(prayerId: string): number {
    const server = this.communityServerBaseline(prayerId);
    return (
      this.prayedForSync?.displayCount(server, prayerId, 'community_prayer') ??
      server
    );
  }

  reprojectCommunityPrayers(): void {
    const all = this.withCommunityDisplayCounts(
      this.toCommunityServerOnly(this.allPrayersSubject.value)
    );
    this.allPrayersSubject.next(all);
    this.prayersSubject.next(
      this.withCommunityDisplayCounts(
        this.toCommunityServerOnly(this.prayersSubject.value)
      )
    );
  }

  publishCommunityPrayers(
    serverPrayers: PrayerRequest[],
    tenantId: string
  ): void {
    this.seedCommunityServerCounts(serverPrayers);
    const displayed = this.withCommunityDisplayCounts(serverPrayers);
    this.setCachedSharedPrayers(
      tenantId,
      this.toCommunityServerOnly(serverPrayers)
    );
    this.allPrayersSubject.next(displayed);
  }

  showCachedCommunityPrayers(cached: PrayerRequest[]): void {
    this.seedCommunityServerCounts(cached);
    this.allPrayersSubject.next(this.withCommunityDisplayCounts(cached));
    this.facadeHooks.applyFilters(this.currentFilters);
  }

  async loadPrayers(silentRefresh = false): Promise<void> {
    try {
      console.log('[PrayerService] Loading prayers...');
      const tenantId = this.getActiveTenantId();
      if (!tenantId) {
        console.log(
          '[PrayerService] No active tenant yet — deferring shared prayer load'
        );
        this.errorSubject.next(null);
        return;
      }

      const cachedPrayers = this.getCachedSharedPrayers(tenantId);
      if (cachedPrayers && cachedPrayers.length > 0) {
        console.log(
          `[PrayerService] Using cached prayers (${cachedPrayers.length} items)`
        );
        this.seedCommunityServerCounts(cachedPrayers);
        this.allPrayersSubject.next(
          this.withCommunityDisplayCounts(cachedPrayers)
        );
        this.facadeHooks.applyFilters(this.currentFilters);

        if (silentRefresh) {
          console.log(
            '[PrayerService] Cache hit for silent refresh - skipping database query'
          );
          return;
        }
      }

      if (!this.connectivity.isOnline()) {
        const stale = this.getStaleSharedPrayers(tenantId);
        if (stale) {
          console.log(
            `[PrayerService] Offline — showing ${stale.length} stale cached prayers`
          );
          this.seedCommunityServerCounts(stale);
          this.allPrayersSubject.next(this.withCommunityDisplayCounts(stale));
          this.facadeHooks.applyFilters(this.currentFilters);
        } else {
          console.log('[PrayerService] Offline with no cached prayers');
          this.allPrayersSubject.next([]);
          this.facadeHooks.applyFilters(this.currentFilters);
        }
        this.errorSubject.next(null);
        return;
      }

      if (!silentRefresh && !cachedPrayers) {
        this.loadingSubject.next(true);
      }
      this.errorSubject.next(null);

      const useSuperAdminRpc = this.shouldUseSuperAdminRpc();
      const actorEmail = useSuperAdminRpc
        ? await this.facadeHooks.getUserEmail()
        : null;
      const { prayersData, error } = await fetchApprovedSharedPrayers(
        this.supabase.client,
        {
          tenantId,
          useSuperAdminRpc,
          actorEmail,
        }
      );
      if (error) throw error;

      console.log(
        `[PrayerService] Loaded ${prayersData?.length || 0} approved prayers from database`
      );

      const prayerIds = (prayersData || []).map((p: any) => p.id).filter(Boolean);
      let updatesByPrayerId = new Map<string, any[]>();
      if (prayerIds.length > 0) {
        const { updatesData, error: updatesError } =
          await fetchApprovedSharedPrayerUpdates(
            this.supabase.client,
            prayerIds,
            {
              tenantId,
              useSuperAdminRpc,
              actorEmail,
            }
          );
        if (updatesError) {
          console.error(
            '[PrayerService] Failed to load prayer updates (continuing with prayers only):',
            updatesError
          );
        } else {
          updatesByPrayerId = groupPrayerUpdatesByPrayerId(updatesData);
        }
      }

      const sortedPrayers = formatApprovedCommunityPrayersFromUpdatesMap(
        prayersData || [],
        updatesByPrayerId
      );

      this.publishCommunityPrayers(sortedPrayers, tenantId);
      this.facadeHooks.applyFilters(this.currentFilters);
      this.badgeService.refreshBadgeCounts();
    } catch (err) {
      const errorMessage =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: unknown }).message ?? 'Failed to load prayers')
          : err instanceof Error
            ? err.message
            : 'Failed to load prayers';
      console.error('[PrayerService] Failed to load prayers:', err);

      const fallbackTenantId = this.getActiveTenantId();
      const cachedPrayers = fallbackTenantId
        ? this.getCachedSharedPrayers(fallbackTenantId) ||
          this.getStaleSharedPrayers(fallbackTenantId)
        : null;
      if (cachedPrayers && cachedPrayers.length > 0) {
        console.log(
          `[PrayerService] Showing ${cachedPrayers.length} cached prayers (error fallback)`
        );
        this.seedCommunityServerCounts(cachedPrayers);
        this.allPrayersSubject.next(
          this.withCommunityDisplayCounts(cachedPrayers)
        );
        this.facadeHooks.applyFilters(this.currentFilters);
        this.errorSubject.next(null);
      } else if (
        this.supabase.isNetworkError(err) ||
        !this.connectivity.isOnline()
      ) {
        this.errorSubject.next(null);
        this.allPrayersSubject.next([]);
        this.facadeHooks.applyFilters(this.currentFilters);
      } else {
        this.errorSubject.next(errorMessage);
        const now = Date.now();
        if (
          now - this.lastLoadErrorToastTime >
          PrayerCommunityService.LOAD_ERROR_TOAST_COOLDOWN_MS
        ) {
          this.lastLoadErrorToastTime = now;
          this.toast.error('Failed to load prayers');
        }
      }
    } finally {
      this.loadingSubject.next(false);
    }
  }

  async getPrayersByMonth(
    year: number,
    month: number
  ): Promise<PrayerRequest[]> {
    try {
      const tenantId = this.getActiveTenantId();
      const { startDate, endDate } = prayersByMonthIsoRange(year, month);
      const { data: prayersData, error } = await fetchCommunityPrayersByMonth(
        this.supabase.client,
        startDate,
        endDate,
        tenantId
      );
      if (error) throw error;

      const prayerIds = (prayersData || [])
        .map((p: any) => p.id)
        .filter(Boolean);
      let updatesByPrayerId = new Map<string, any[]>();
      if (prayerIds.length > 0) {
        const { data: updatesData, error: updatesError } =
          await fetchCommunityPrayerUpdatesByPrayerIds(
            this.supabase.client,
            prayerIds,
            tenantId
          );
        if (updatesError) {
          console.error(
            '[PrayerService] Failed to load monthly prayer updates:',
            updatesError
          );
        } else {
          updatesByPrayerId = groupPrayerUpdatesByPrayerId(updatesData);
        }
      }

      return formatPrayersByMonthFromSeparateUpdates(
        prayersData || [],
        updatesByPrayerId
      );
    } catch (err) {
      console.error(
        `[PrayerService] Failed to load prayers for ${year}-${month}:`,
        err
      );
      return [];
    }
  }

  applyFilters(filters: PrayerFilters): void {
    this.currentFilters = filters;
    this.prayersSubject.next(
      applyPrayerCatalogFilters(this.allPrayersSubject.getValue(), filters)
    );
  }

  async addPrayer(
    prayer: Omit<
      PrayerRequest,
      'id' | 'date_requested' | 'created_at' | 'updated_at' | 'updates'
    >
  ): Promise<boolean> {
    if (!this.connectivity.requireOnline('submit a prayer')) {
      return false;
    }
    try {
      const tenantId = this.getActiveTenantId();
      if (!tenantId) {
        this.toast.error(
          'Select an organization to submit a public prayer request.'
        );
        return false;
      }

      const prayerData = buildCommunityPrayerInsertRow(
        {
          ...prayer,
          requester:
            resolveAuthorName(prayer.requester, prayer.email) || 'Unknown',
        },
        tenantId
      );

      const prayerId = crypto.randomUUID();
      const { error } = await insertCommunityPrayerRowNoReturning(
        this.supabase.client,
        { id: prayerId, ...prayerData }
      );
      if (error) throw error;

      if (prayer.email && tenantId) {
        try {
          const { data: existing } = await findTenantMembershipByEmail(
            this.supabase.client,
            tenantId,
            prayer.email.toLowerCase().trim()
          );
          if (!existing) {
            await insertTenantMembershipMemberRow(this.supabase.client, {
              name: prayer.requester,
              user_email: prayer.email.toLowerCase().trim(),
              tenant_id: tenantId,
            });
          }
        } catch (subscribeError) {
          console.error('Failed to auto-subscribe user:', subscribeError);
        }
      }

      this.emailNotification
        .sendAdminNotification(
          buildCommunityPrayerAdminNotificationPayload(
            prayer,
            prayerId,
            tenantId
          )
        )
        .catch((err) =>
          console.error('Failed to send admin notification:', err)
        );

      this.toast.success('Prayer request submitted for approval');
      return true;
    } catch (error) {
      console.error('Error adding prayer:', error);
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message)
          : '';
      if (msg.includes('row-level security') || msg.includes('RLS')) {
        this.toast.error(
          'Could not submit prayer (server permission). Try signing in again.'
        );
      } else if (msg) {
        this.toast.error(`Failed to submit prayer request: ${msg}`);
      } else {
        this.toast.error('Failed to submit prayer request');
      }
      return false;
    }
  }

  async updatePrayerStatus(id: string, status: PrayerStatus): Promise<boolean> {
    if (!this.connectivity.requireOnline('update prayer status')) {
      return false;
    }
    try {
      const tenantId = this.getActiveTenantId();
      const { error } = await updateCommunityPrayerStatusRow(
        this.supabase.client,
        id,
        buildCommunityPrayerStatusUpdatePayload(status),
        tenantId
      );
      if (error) throw error;

      this.prayersSubject.next(
        patchCommunityPrayerStatus(this.prayersSubject.value, id, status)
      );

      this.toast.success(`Prayer marked as ${status}`);
      return true;
    } catch (error) {
      console.error('Error updating prayer status:', error);
      this.toast.error('Failed to update prayer status');
      return false;
    }
  }

  async incrementPrayedFor(prayerId: string): Promise<number | null> {
    this.communityServerBaseline(prayerId);
    if (!this.prayedForSync?.enqueue('community_prayer', prayerId)) {
      return null;
    }
    void this.prayedForSync.flush();
    return this.displayCommunityPrayedForCount(prayerId);
  }

  async addPrayerUpdate(
    prayerId: string,
    content: string,
    author: string
  ): Promise<boolean> {
    if (!this.connectivity.requireOnline('add a prayer update')) {
      return false;
    }
    try {
      const tenantId = this.getActiveTenantId();
      const { data, error } = await insertPendingCommunityPrayerUpdate(
        this.supabase.client,
        prayerId,
        content,
        author,
        tenantId
      );
      if (error) throw error;
      if (!data) throw new Error('Prayer update insert returned no row');

      const { data: prayer } = await fetchCommunityPrayerTitle(
        this.supabase.client,
        prayerId
      );
      if (prayer && tenantId) {
        this.emailNotification
          .sendAdminNotification({
            type: 'update',
            title: prayer.title,
            author,
            content,
            requestId: data.id,
            tenantId,
          })
          .catch((err) =>
            console.error('Failed to send admin notification:', err)
          );
      }

      this.toast.success('Update submitted for approval');
      return true;
    } catch (error) {
      console.error('Error adding prayer update:', error);
      this.toast.error('Failed to add update');
      return false;
    }
  }

  async deletePrayer(id: string): Promise<boolean> {
    if (!this.connectivity.requireOnline('delete a prayer')) {
      return false;
    }
    try {
      const tenantId = this.getActiveTenantId();
      const { error } = await deleteCommunityPrayerRow(
        this.supabase.client,
        id,
        tenantId
      );
      if (error) throw error;

      applyCommunityPrayerDeleteSnapshot(
        this.prayersSubject.value,
        this.allPrayersSubject.value,
        id,
        {
          setFilteredPrayers: (prayers) => this.prayersSubject.next(prayers),
          setAllPrayers: (prayers) => this.allPrayersSubject.next(prayers),
          setCache: (prayers) =>
            this.setCachedSharedPrayers(tenantId, prayers),
          reapplyFilters: () =>
            this.facadeHooks.applyFilters(this.currentFilters),
          refreshBadges: () => this.badgeService.refreshBadgeCounts(),
          dropReminders: () => undefined,
        }
      );

      this.toast.success('Prayer deleted');
      return true;
    } catch (error) {
      console.error('Error deleting prayer:', error);
      this.toast.error('Failed to delete prayer');
      return false;
    }
  }

  async deletePrayerUpdate(updateId: string): Promise<boolean> {
    if (!this.connectivity.requireOnline('delete an update')) {
      return false;
    }
    try {
      const tenantId = this.getActiveTenantId();
      const { error } = await deleteCommunityPrayerUpdateRow(
        this.supabase.client,
        updateId,
        tenantId
      );
      if (error) throw error;

      await this.facadeHooks.loadPrayers();
      this.toast.success('Update deleted');
      return true;
    } catch (error) {
      console.error('Error deleting prayer update:', error);
      this.toast.error('Failed to delete update');
      return false;
    }
  }

  getFilteredPrayers(filters: PrayerFilters): PrayerRequest[] {
    return filterPrayerRequestsByStatusAndSearch(
      this.prayersSubject.value,
      filters
    );
  }

  async addUpdate(updateData: CommunityUpdateSubmitData): Promise<boolean> {
    if (!this.connectivity.requireOnline('add a prayer update')) {
      return false;
    }
    try {
      const tenantId = this.getActiveTenantId();
      const author =
        resolveAuthorName(updateData.author, updateData.author_email) ||
        'Unknown';
      const { data, error } = await insertPendingCommunityUpdate(
        this.supabase.client,
        { ...updateData, author },
        tenantId
      );
      if (error) throw error;
      if (!data) throw new Error('Prayer update insert returned no row');

      const { data: prayer } = await fetchCommunityPrayerTitle(
        this.supabase.client,
        updateData.prayer_id
      );
      if (prayer && tenantId) {
        this.emailNotification
          .sendAdminNotification({
            type: 'update',
            title: prayer.title,
            author,
            content: updateData.content,
            requestId: data.id,
            tenantId,
          })
          .catch((err) =>
            console.error('Failed to send admin notification:', err)
          );
      }

      this.toast.success('Update submitted for approval');
      return true;
    } catch (error) {
      console.error('Error adding update:', error);
      this.toast.error('Failed to add update');
      return false;
    }
  }

  async deleteUpdate(updateId: string): Promise<boolean> {
    if (!this.connectivity.requireOnline('delete an update')) {
      return false;
    }
    try {
      const tenantId = this.getActiveTenantId();
      const { error } = await deleteCommunityPrayerUpdateRow(
        this.supabase.client,
        updateId,
        tenantId
      );
      if (error) throw error;

      this.toast.success('Update deleted');
      await this.facadeHooks.loadPrayers();
      return true;
    } catch (error) {
      console.error('Error deleting update:', error);
      this.toast.error('Failed to delete update');
      return false;
    }
  }

  async requestDeletion(
    requestData: PrayerDeletionRequestInput
  ): Promise<boolean> {
    if (!this.connectivity.requireOnline('request deletion')) {
      return false;
    }
    try {
      const tenantId = this.getActiveTenantId();
      const { data, error } = await insertPrayerDeletionRequestRow(
        this.supabase.client,
        requestData,
        tenantId
      );
      if (error) throw error;

      await notifyPrayerDeletionRequestSubmitted(
        requestData,
        data?.id,
        async () => {
          const { data: prayerRow } = await fetchPrayerRowForDeletionNotify(
            this.supabase.client,
            requestData.prayer_id,
            tenantId
          );
          return prayerRow;
        },
        (payload) =>
          this.emailNotification.sendAdminNotification({
            ...payload,
            ...(tenantId ? { tenantId } : {}),
          })
      );

      this.toast.success('Deletion request submitted for review');
      return true;
    } catch (error) {
      console.error('Error requesting deletion:', error);
      this.toast.error('Failed to submit deletion request');
      return false;
    }
  }

  async requestUpdateDeletion(
    requestData: UpdateDeletionRequestInput
  ): Promise<boolean> {
    if (!this.connectivity.requireOnline('request deletion')) {
      return false;
    }
    try {
      const tenantId = this.getActiveTenantId();
      const { data, error } = await insertUpdateDeletionRequestRow(
        this.supabase.client,
        requestData,
        tenantId
      );
      if (error) throw error;

      await notifyUpdateDeletionRequestSubmitted(
        requestData,
        data?.id,
        async () => {
          const { data: updateRow } =
            await fetchPrayerUpdateRowForDeletionNotify(
              this.supabase.client,
              requestData.update_id,
              tenantId
            );
          return updateRow;
        },
        (payload) =>
          this.emailNotification.sendAdminNotification({
            ...payload,
            ...(tenantId ? { tenantId } : {}),
          })
      );

      this.toast.success('Update deletion request submitted for review');
      return true;
    } catch (error) {
      console.error('Error requesting update deletion:', error);
      this.toast.error('Failed to submit update deletion request');
      return false;
    }
  }
}
