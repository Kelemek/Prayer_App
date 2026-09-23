import { Injectable, Optional } from '@angular/core';
import {
  distinctUntilChanged,
  combineLatest,
  filter,
  map,
  type Subscription,
} from 'rxjs';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';
import { EmailNotificationService } from './email-notification.service';
import { VerificationService } from './verification.service';
import { CacheService } from './cache.service';
import { BadgeService } from './badge.service';
import { UserSessionService } from './user-session.service';
import { TenantContextService } from './tenant-context.service';
import { ConnectivityService } from './connectivity.service';
import {
  PrayedForSyncService,
  type PrayedForSyncedEvent,
} from './prayed-for-sync.service';
import { PrayerCommunityService } from './prayer-community.service';
import { PrayerPersonalService } from './prayer-personal.service';
import type { Tenant } from '../types/tenant';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  mergePrayerResumeListenerSubscriptions,
  runResumeCommunityPrayerRefresh,
  scheduleDebouncedResumeRefresh,
  unsubscribePrayerResumeListeners,
  wirePrayerResumeListeners,
} from '../lib/prayer-service-resume';
import {
  handlePrayerRealtimeSubscribeStatus,
  subscribePrayerCatalogRealtime,
} from '../lib/prayer-service-realtime';
import {
  PRAYER_REALTIME_MAX_RESUBSCRIBE_ATTEMPTS,
  PRAYER_REALTIME_RESUBSCRIBE_DELAY_MS,
  PRAYER_SERVICE_RESUME_REFRESH_DEBOUNCE_MS,
} from '../lib/prayer-service-constants';
import type { PrayerCatalogRefreshOptions } from '../lib/prayer-catalog-load';
import {
  personalPrayerSessionAction,
  userSessionEmailDistinctEqual,
} from '../lib/prayer-service-session-wire';
import type {
  PrayerFilters,
  PrayerRequest,
  PrayerStatus,
  PrayerUpdate,
} from '../lib/prayer-types';
import type { CommunityUpdateSubmitData } from '../lib/prayer-community-mutations';
import type {
  PrayerDeletionRequestInput,
  UpdateDeletionRequestInput,
} from '../lib/prayer-community-deletion-requests';

export type { PrayerFilters, PrayerRequest, PrayerStatus, PrayerUpdate };

@Injectable({
  providedIn: 'root',
})
export class PrayerService {
  private readonly community: PrayerCommunityService;
  private readonly personal: PrayerPersonalService;

  private realtimeChannel: RealtimeChannel | null = null;
  private realtimeResubscribeTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveRealtimeDisconnects = 0;
  private unsubscribeClientReplaced: (() => void) | null = null;
  private tornDown = false;
  private resumeRefreshTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private resumeListenerSubscriptions: Subscription[] = [];
  private static readonly RESUME_REFRESH_DEBOUNCE_MS =
    PRAYER_SERVICE_RESUME_REFRESH_DEBOUNCE_MS;

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private emailNotification: EmailNotificationService,
    private verificationService: VerificationService,
    private cache: CacheService,
    badgeService: BadgeService,
    private userSessionService: UserSessionService,
    private tenantContext: TenantContextService,
    private connectivity: ConnectivityService,
    @Optional() private prayedForSync: PrayedForSyncService | null = null
  ) {
    this.community = new PrayerCommunityService(
      supabase,
      toast,
      emailNotification,
      cache,
      badgeService,
      connectivity,
      tenantContext,
      prayedForSync,
      {
        loadPrayers: (silentRefresh) => this.loadPrayers(silentRefresh),
        applyFilters: (filters) => this.applyFilters(filters),
        getUserEmail: () => this.getUserEmail(),
      }
    );
    this.personal = new PrayerPersonalService(
      supabase,
      toast,
      cache,
      connectivity,
      tenantContext,
      prayedForSync,
      userSessionService,
      emailNotification,
      {
        getUserEmail: () => this.getUserEmail(),
        loadPersonalPrayers: () => this.loadPersonalPrayers(),
      }
    );
    this.bindSupabaseClientReplaced();
    this.initializePrayers();
    this.attachPrayedForSyncListeners();
  }

  get allPrayers$() {
    return this.community.allPrayers$;
  }
  get prayers$() {
    return this.community.prayers$;
  }
  get loading$() {
    return this.community.loading$;
  }
  get error$() {
    return this.community.error$;
  }
  get allPersonalPrayers$() {
    return this.personal.allPersonalPrayers$;
  }
  get personalCategories$() {
    return this.personal.personalCategories$;
  }
  get loadingPersonalPrayers$() {
    return this.personal.loadingPersonalPrayers$;
  }

  /** Spec-compatible aliases for catalog state that tests access via `(service as any)`. */
  get allPrayersSubject() {
    return this.community.allPrayersSubject;
  }
  get prayersSubject() {
    return this.community.prayersSubject;
  }
  get errorSubject() {
    return this.community.errorSubject;
  }
  get loadingSubject() {
    return this.community.loadingSubject;
  }
  get allPersonalPrayersSubject() {
    return this.personal.allPersonalPrayersSubject;
  }
  get loadingPersonalPrayersSubject() {
    return this.personal.loadingPersonalPrayersSubject;
  }
  get currentFilters() {
    return this.community.currentFilters;
  }
  set currentFilters(filters: PrayerFilters) {
    this.community.currentFilters = filters;
  }

  getAllCommunityPrayersSnapshot(): PrayerRequest[] {
    return this.community.getAllCommunityPrayersSnapshot();
  }

  getPersonalPrayersSnapshot(): PrayerRequest[] {
    return this.personal.getPersonalPrayersSnapshot();
  }

  private attachPrayedForSyncListeners(): void {
    if (!this.prayedForSync) {
      return;
    }
    this.prayedForSync.pendingChanged$.subscribe(() => {
      this.community.reprojectCommunityPrayers();
      this.personal.reprojectPersonalPrayers();
    });
    this.prayedForSync.synced$.subscribe((event) => {
      this.onPrayedForSynced(event);
    });
  }

  private onPrayedForSynced(event: PrayedForSyncedEvent): void {
    if (!this.userSessionService.getUserEmail()) {
      return;
    }
    switch (event.kind) {
      case 'community_prayer':
        this.community.communityServerPrayedFor.set(
          event.itemId,
          event.serverCount
        );
        this.community.reprojectCommunityPrayers();
        break;
      case 'personal_prayer':
        this.personal.personalServerPrayedFor.set(
          event.itemId,
          event.serverCount
        );
        this.personal.reprojectPersonalPrayers();
        break;
      case 'prompt':
        break;
      default: {
        const _exhaustive: never = event.kind;
        return _exhaustive;
      }
    }
  }

  private async initializePrayers(): Promise<void> {
    this.setupTenantScopedPrayerLoading();

    this.userSessionService.userSession$
      .pipe(distinctUntilChanged(userSessionEmailDistinctEqual))
      .subscribe((session) => {
        const action = personalPrayerSessionAction(session);
        if (action === 'load') {
          this.loadPersonalPrayers().catch((err) =>
            console.error(
              '[PrayerService] Error loading personal prayers on session change:',
              err
            )
          );
        } else {
          this.personal.clearCatalogOnLogout();
        }
      });

    this.setupRealtimeSubscription();
    this.setupResumeListeners();
  }

  private setupTenantScopedPrayerLoading(): void {
    const loading$ = this.tenantContext.loading$;
    const activeTenant$ = this.tenantContext.activeTenant$;
    if (!loading$ || !activeTenant$) {
      return;
    }

    combineLatest([
      loading$.pipe(filter((loading) => !loading)),
      activeTenant$.pipe(filter((tenant): tenant is Tenant => !!tenant?.id)),
    ])
      .pipe(
        map(([, tenant]) => tenant.id),
        distinctUntilChanged()
      )
      .subscribe(() => {
        void this.reloadPrayersForActiveTenant();
      });
  }

  private async reloadPrayersForActiveTenant(): Promise<void> {
    const tenantId = this.community.getActiveTenantId();
    if (!tenantId) {
      return;
    }

    if (this.connectivity.isOnline()) {
      try {
        await this.supabase.ensureConnected();
      } catch (err) {
        console.debug(
          '[PrayerService] ensureConnected before tenant prayer load failed:',
          err
        );
      }
    }

    try {
      await this.loadPrayers(false);
    } catch (err) {
      console.error('[PrayerService] Error loading prayers for tenant:', err);
    }

    try {
      await this.loadPersonalPrayers(false);
    } catch (err) {
      console.error(
        '[PrayerService] Error loading personal prayers for tenant:',
        err
      );
    }
  }

  async loadPrayers(
    silentRefresh = false,
    options?: PrayerCatalogRefreshOptions
  ): Promise<void> {
    return this.community.loadPrayers(silentRefresh, options);
  }

  async loadPersonalPrayers(
    silentRefresh = false,
    options?: PrayerCatalogRefreshOptions
  ): Promise<void> {
    return this.personal.loadPersonalPrayers(silentRefresh, options);
  }

  async getPrayersByMonth(
    year: number,
    month: number
  ): Promise<PrayerRequest[]> {
    return this.community.getPrayersByMonth(year, month);
  }

  private setupResumeListeners(): void {
    const added = wirePrayerResumeListeners({
      scheduleResumeRefresh: () => this.scheduleResumeRefresh(),
      onLeaveBackground: () => {
        this.triggerBackgroundRecovery();
      },
    });
    this.resumeListenerSubscriptions = mergePrayerResumeListenerSubscriptions(
      this.resumeListenerSubscriptions,
      added
    );
  }

  private scheduleResumeRefresh(): void {
    this.resumeRefreshTimeoutId = scheduleDebouncedResumeRefresh(
      this.resumeRefreshTimeoutId,
      PrayerService.RESUME_REFRESH_DEBOUNCE_MS,
      () => {
        this.resumeRefreshTimeoutId = null;
        this.runResumeRefresh();
      }
    );
  }

  private async runResumeRefresh(): Promise<void> {
    const tid = this.community.getActiveTenantId();
    await runResumeCommunityPrayerRefresh({
      readCachedPrayers: () =>
        this.community.getCachedSharedPrayers(tid) ||
        this.community.getStaleSharedPrayers(tid),
      onShowCachedPrayers: (cached) => {
        this.community.showCachedCommunityPrayers(cached);
      },
      ensureConnected: () => this.supabase.ensureConnected(),
      loadPrayersSilent: () =>
        this.loadPrayers(true, { bypassWarmCache: true }),
      reconnectRealtimeIfNeeded: () => {
        this.consecutiveRealtimeDisconnects = 0;
        if (this.connectivity.isOnline() && !this.realtimeChannel) {
          this.setupRealtimeSubscription();
        }
      },
      isOnline: () => this.connectivity.isOnline(),
    });
  }

  private triggerBackgroundRecovery(): void {
    this.scheduleResumeRefresh();
  }

  applyFilters(filters: PrayerFilters): void {
    this.community.applyFilters(filters);
  }

  async addPrayer(
    prayer: Omit<
      PrayerRequest,
      'id' | 'date_requested' | 'created_at' | 'updated_at' | 'updates'
    >
  ): Promise<boolean> {
    return this.community.addPrayer(prayer);
  }

  async updatePrayerStatus(id: string, status: PrayerStatus): Promise<boolean> {
    return this.community.updatePrayerStatus(id, status);
  }

  async incrementPrayedFor(prayerId: string): Promise<number | null> {
    return this.community.incrementPrayedFor(prayerId);
  }

  async incrementPersonalPrayedFor(prayerId: string): Promise<number | null> {
    return this.personal.incrementPersonalPrayedFor(prayerId);
  }

  async getMemberPrayedForCountsBatch(
    personIds: string[]
  ): Promise<Record<string, number>> {
    return this.community.getMemberPrayedForCountsBatch(personIds);
  }

  async getMemberPrayerUpdatesBatch(
    personIds: string[]
  ): Promise<Record<string, any[]>> {
    return this.community.getMemberPrayerUpdatesBatch(personIds);
  }

  async getMemberPrayerUpdates(personId: string): Promise<any[]> {
    return this.community.getMemberPrayerUpdates(personId);
  }

  async incrementMemberPrayedFor(personId: string): Promise<number | null> {
    return this.community.incrementMemberPrayedFor(personId);
  }

  async addMemberPrayerUpdate(
    personId: string,
    memberName: string,
    content: string,
    author: string,
    authorEmail: string = '',
    isAnswered: boolean = false,
    listId?: string
  ): Promise<boolean> {
    return this.community.addMemberPrayerUpdate(
      personId,
      memberName,
      content,
      author,
      authorEmail,
      isAnswered,
      listId
    );
  }

  async deleteMemberPrayerUpdate(
    updateId: string,
    personId: string,
    listId?: string
  ): Promise<boolean> {
    return this.community.deleteMemberPrayerUpdate(updateId, personId, listId);
  }

  async updateMemberPrayerUpdate(
    updateId: string,
    personId: string,
    updates: Partial<PrayerUpdate>,
    listId?: string
  ): Promise<boolean> {
    return this.community.updateMemberPrayerUpdate(
      updateId,
      personId,
      updates,
      listId
    );
  }

  async addPrayerUpdate(
    prayerId: string,
    content: string,
    author: string
  ): Promise<boolean> {
    return this.community.addPrayerUpdate(prayerId, content, author);
  }

  async deletePrayer(id: string): Promise<boolean> {
    return this.community.deletePrayer(id);
  }

  async deletePrayerUpdate(updateId: string): Promise<boolean> {
    return this.community.deletePrayerUpdate(updateId);
  }

  getFilteredPrayers(filters: PrayerFilters): PrayerRequest[] {
    return this.community.getFilteredPrayers(filters);
  }

  private bindSupabaseClientReplaced(): void {
    const notify = this.supabase.onClientReplaced;
    if (typeof notify !== 'function') {
      return;
    }
    this.unsubscribeClientReplaced = notify.call(this.supabase, (previous) => {
      this.handleSupabaseClientReplaced(previous);
    });
  }

  private handleSupabaseClientReplaced(previousClient: SupabaseClient): void {
    const channel = this.realtimeChannel;
    this.realtimeChannel = null;
    this.consecutiveRealtimeDisconnects = 0;
    if (channel) {
      this.removeRealtimeChannel(channel, previousClient);
    }
    this.scheduleRealtimeResubscribe();
  }

  private reloadCommunityCatalogFromLiveEvent(): void {
    this.loadPrayers(true, { bypassWarmCache: true }).catch((err) => {
      console.error(
        '[PrayerService] Error reloading prayers after realtime change:',
        err
      );
    });
  }

  private setupRealtimeSubscription(): void {
    if (this.tornDown || this.realtimeChannel || !this.connectivity.isOnline()) {
      return;
    }
    try {
      const channelHolder: { current: RealtimeChannel | null } = { current: null };
      const channel = subscribePrayerCatalogRealtime(this.supabase.client, {
        onPrayersChange: () => {
          this.reloadCommunityCatalogFromLiveEvent();
        },
        onPrayerUpdatesChange: () => {
          this.reloadCommunityCatalogFromLiveEvent();
        },
        onSubscribeStatus: (status) => {
          if (status === 'SUBSCRIBED') {
            this.consecutiveRealtimeDisconnects = 0;
            return;
          }
          handlePrayerRealtimeSubscribeStatus(status, () => {
            queueMicrotask(() => this.dropAndResubscribe(channelHolder.current));
          });
        },
      });
      channelHolder.current = channel;
      this.realtimeChannel = channel;
    } catch (error) {
      console.error(
        '[PrayerService] Error setting up realtime subscription:',
        error
      );
    }
  }

  private dropAndResubscribe(channel: RealtimeChannel | null): void {
    if (this.tornDown || !channel || this.realtimeChannel !== channel) {
      return;
    }
    this.realtimeChannel = null;
    this.removeRealtimeChannel(channel, this.supabase.client);
    this.consecutiveRealtimeDisconnects += 1;
    if (
      this.consecutiveRealtimeDisconnects >
      PRAYER_REALTIME_MAX_RESUBSCRIBE_ATTEMPTS
    ) {
      console.warn(
        '[PrayerService] Realtime resubscribe paused until the app resumes'
      );
      return;
    }
    this.scheduleRealtimeResubscribe();
  }

  private scheduleRealtimeResubscribe(): void {
    if (this.tornDown || this.realtimeResubscribeTimer != null) {
      return;
    }
    this.realtimeResubscribeTimer = setTimeout(() => {
      this.realtimeResubscribeTimer = null;
      if (this.tornDown || this.realtimeChannel) {
        return;
      }
      this.setupRealtimeSubscription();
    }, PRAYER_REALTIME_RESUBSCRIBE_DELAY_MS);
  }

  private removeRealtimeChannel(
    channel: RealtimeChannel,
    client: SupabaseClient
  ): void {
    if (typeof client.removeChannel !== 'function') {
      return;
    }
    try {
      const result = client.removeChannel(channel) as unknown;
      if (
        result &&
        typeof (result as Promise<unknown>).then === 'function'
      ) {
        void (result as Promise<unknown>).catch((err) => {
          console.error('[PrayerService] Failed to remove realtime channel:', err);
        });
      }
    } catch (err) {
      console.error('[PrayerService] Failed to remove realtime channel:', err);
    }
  }

  private clearRealtimeResubscribeTimer(): void {
    if (this.realtimeResubscribeTimer != null) {
      clearTimeout(this.realtimeResubscribeTimer);
      this.realtimeResubscribeTimer = null;
    }
  }

  async cleanup(): Promise<void> {
    this.tornDown = true;
    try {
      this.unsubscribeClientReplaced?.();
      this.unsubscribeClientReplaced = null;
      this.clearRealtimeResubscribeTimer();
      unsubscribePrayerResumeListeners(this.resumeListenerSubscriptions);
      this.resumeListenerSubscriptions = [];
      if (this.resumeRefreshTimeoutId != null) {
        clearTimeout(this.resumeRefreshTimeoutId);
        this.resumeRefreshTimeoutId = null;
      }
      if (this.realtimeChannel) {
        await this.supabase.client.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
      }
    } catch (error) {
      console.error('[PrayerService] Error during cleanup:', error);
    }
  }

  async addUpdate(updateData: CommunityUpdateSubmitData): Promise<boolean> {
    return this.community.addUpdate(updateData);
  }

  async deleteUpdate(updateId: string): Promise<boolean> {
    return this.community.deleteUpdate(updateId);
  }

  async requestDeletion(
    requestData: PrayerDeletionRequestInput
  ): Promise<boolean> {
    return this.community.requestDeletion(requestData);
  }

  async requestUpdateDeletion(
    requestData: UpdateDeletionRequestInput
  ): Promise<boolean> {
    return this.community.requestUpdateDeletion(requestData);
  }

  private async getUserEmail(): Promise<string | null> {
    try {
      const {
        data: { session },
      } = await this.supabase.client.auth.getSession();
      if (session?.user?.email) {
        return session.user.email;
      }
    } catch (error) {
      console.error('Error getting session:', error);
    }
    return null;
  }

  async getPersonalPrayers(
    forceRefresh: boolean = false
  ): Promise<PrayerRequest[]> {
    return this.personal.getPersonalPrayers(forceRefresh);
  }

  getPersonalCategoriesSnapshot() {
    return this.personal.getPersonalCategoriesSnapshot();
  }

  async loadPersonalCategories(forceRefresh = false) {
    return this.personal.loadPersonalCategories(forceRefresh);
  }

  async createPersonalCategory(name: string, color: string) {
    return this.personal.createPersonalCategory(name, color);
  }

  async renamePersonalCategory(
    oldCategory: string,
    newCategory: string,
    options?: { reservedCategoryNames?: string[] }
  ): Promise<boolean> {
    return this.personal.renamePersonalCategory(
      oldCategory,
      newCategory,
      options
    );
  }

  async deletePersonalCategory(category: string): Promise<boolean> {
    return this.personal.deletePersonalCategory(category);
  }

  async addPersonalPrayer(
    prayer: Omit<
      PrayerRequest,
      | 'id'
      | 'date_requested'
      | 'created_at'
      | 'updated_at'
      | 'updates'
      | 'approval_status'
    >
  ): Promise<boolean> {
    return this.personal.addPersonalPrayer(prayer);
  }

  async deletePersonalPrayer(id: string): Promise<boolean> {
    return this.personal.deletePersonalPrayer(id);
  }

  async updatePersonalPrayer(
    id: string,
    updates: Partial<
      Pick<PrayerRequest, 'title' | 'prayer_for' | 'description' | 'category'>
    >,
    options?: { successToast?: boolean }
  ): Promise<boolean> {
    return this.personal.updatePersonalPrayer(id, updates, options);
  }

  async updatePersonalPrayerOrder(
    prayers: PrayerRequest[],
    categoryFilter?: string
  ): Promise<boolean> {
    return this.personal.updatePersonalPrayerOrder(prayers, categoryFilter);
  }

  async updatePersonalPrayerUpdate(
    updateId: string,
    prayerId: string,
    updates: Partial<Pick<PrayerUpdate, 'content'>>
  ): Promise<boolean> {
    return this.personal.updatePersonalPrayerUpdate(
      updateId,
      prayerId,
      updates
    );
  }

  async getUniqueCategoriesForUser(
    prayers?: PrayerRequest[]
  ): Promise<string[]> {
    return this.personal.getUniqueCategoriesForUser(prayers);
  }

  async addPersonalPrayerUpdate(
    personalPrayerId: string,
    content: string,
    author: string,
    authorEmail: string,
    markAsAnswered: boolean = false
  ): Promise<boolean> {
    return this.personal.addPersonalPrayerUpdate(
      personalPrayerId,
      content,
      author,
      authorEmail,
      markAsAnswered
    );
  }

  async deletePersonalPrayerUpdate(updateId: string): Promise<boolean> {
    return this.personal.deletePersonalPrayerUpdate(updateId);
  }

  async markPersonalPrayerUpdateAsAnswered(updateId: string): Promise<boolean> {
    return this.personal.markPersonalPrayerUpdateAsAnswered(updateId);
  }

  async reorderCategories(orderedIds: string[]): Promise<boolean> {
    return this.personal.reorderCategories(orderedIds);
  }

  ngOnDestroy(): void {
    this.tornDown = true;
    this.unsubscribeClientReplaced?.();
    this.unsubscribeClientReplaced = null;
    this.clearRealtimeResubscribeTimer();
    unsubscribePrayerResumeListeners(this.resumeListenerSubscriptions);
    this.resumeListenerSubscriptions = [];
    if (this.resumeRefreshTimeoutId != null) {
      clearTimeout(this.resumeRefreshTimeoutId);
      this.resumeRefreshTimeoutId = null;
    }
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }
}
