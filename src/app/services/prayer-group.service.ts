import { Injectable, Injector } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthIdentityService } from './auth-identity.service';
import { ConnectivityService } from './connectivity.service';
import { ToastService } from './toast.service';
import { UserSessionService } from './user-session.service';
import { EmailNotificationService } from './email-notification.service';
import { CacheService } from './cache.service';
import type {
  PrayerGroup,
  PrayerGroupMember,
  PrayerGroupMembershipProfile,
} from '../types/prayer-group';
import type { PrayerRequest } from '../lib/prayer-types';
import type { PrayerFormSubmitPayload } from '../lib/prayer-form-submit';
import { PrayerGroupInternalState } from '../lib/prayer-group-internal.state';
import { PrayerGroupCatalogOps } from '../lib/prayer-group-catalog.ops';
import { PrayerGroupPrayersOps } from '../lib/prayer-group-prayers.ops';
import type {
  PrayerGroupHostBridge,
  PrayerGroupOpsDeps,
} from '../lib/prayer-group-ops-deps';
import { GroupPrayerBadgeService } from './group-prayer-badge.service';

@Injectable({ providedIn: 'root' })
export class PrayerGroupService {
  private readonly state = new PrayerGroupInternalState();
  private readonly deps: PrayerGroupOpsDeps;
  private readonly catalog: PrayerGroupCatalogOps;
  private readonly prayers: PrayerGroupPrayersOps;

  readonly groups$ = this.state.groupsSubject.asObservable();
  readonly prayers$ = this.state.prayersSubject.asObservable();
  readonly groupPrayerCounts$ = this.state.prayerCountsSubject.asObservable();
  readonly loadingGroups$ = this.state.loadingGroupsSubject.asObservable();
  readonly loadingPrayers$ = this.state.loadingPrayersSubject.asObservable();

  constructor(
    supabase: SupabaseService,
    authIdentity: AuthIdentityService,
    connectivity: ConnectivityService,
    toast: ToastService,
    userSession: UserSessionService,
    emailNotification: EmailNotificationService,
    cache: CacheService,
    private readonly injector: Injector
  ) {
    this.deps = {
      supabase,
      authIdentity,
      connectivity,
      toast,
      userSession,
      emailNotification,
      cache,
      refreshGroupBadgeCounts: () => this.refreshGroupBadgeCounts(),
    };

    const host: PrayerGroupHostBridge = {
      loadGroupPrayers: (groupId, silentRefresh) =>
        this.loadGroupPrayers(groupId, silentRefresh),
      hydrateGroupPrayers: (options) => this.hydrateGroupPrayers(options),
    };

    this.catalog = new PrayerGroupCatalogOps(this.state, this.deps);
    this.prayers = new PrayerGroupPrayersOps(
      this.state,
      this.deps,
      this.catalog,
      host
    );
    this.prayers.setupResumeListeners();
  }

  getGroups(): PrayerGroup[] {
    return this.catalog.getGroups();
  }

  getGroupPrayers(): PrayerRequest[] {
    return this.prayers.getGroupPrayers();
  }

  getGroupPrayerCount(groupId: string): number {
    return this.prayers.getGroupPrayerCount(groupId);
  }

  getAllCachedGroupPrayers(): PrayerRequest[] {
    return this.prayers.getAllCachedGroupPrayers();
  }

  canCreatePrayerGroups(): boolean {
    return this.catalog.canCreatePrayerGroups();
  }

  canAccessGroupsTab(): boolean {
    return this.catalog.canAccessGroupsTab();
  }

  refreshCapabilities(): Promise<void> {
    return this.catalog.refreshCapabilities();
  }

  loadMyGroups(): Promise<PrayerGroup[]> {
    return this.catalog.loadMyGroups();
  }

  createGroup(name: string): Promise<PrayerGroup | null> {
    return this.catalog.createGroup(name);
  }

  inviteMembers(groupId: string, emails: string[]): Promise<number> {
    return this.catalog.inviteMembers(groupId, emails);
  }

  reorderGroups(orderedGroupIds: string[]): Promise<boolean> {
    return this.catalog.reorderGroups(orderedGroupIds);
  }

  renameGroup(groupId: string, name: string): Promise<boolean> {
    return this.catalog.renameGroup(groupId, name);
  }

  deleteGroup(groupId: string): Promise<boolean> {
    return this.catalog.deleteGroup(groupId, (deletedGroupId) => {
      this.prayers.onGroupDeleted(deletedGroupId);
    });
  }

  leaveGroup(groupId: string): Promise<boolean> {
    return this.catalog.leaveGroup(groupId);
  }

  loadGroupMembers(groupId: string): Promise<PrayerGroupMember[]> {
    return this.catalog.loadGroupMembers(groupId);
  }

  removeMember(groupId: string, email: string): Promise<boolean> {
    return this.catalog.removeMember(groupId, email);
  }

  getMembershipProfile(
    email?: string | null
  ): Promise<PrayerGroupMembershipProfile> {
    return this.catalog.getMembershipProfile(email);
  }

  setMemberName(fullName: string): Promise<boolean> {
    return this.catalog.setMemberName(fullName);
  }

  hydrateGroupPrayers(options: {
    force: boolean;
    focusGroupId?: string | null;
  }): Promise<void> {
    return this.prayers.hydrateGroupPrayers(options);
  }

  loadGroupPrayers(
    groupId: string | null,
    silentRefresh = false
  ): Promise<PrayerRequest[]> {
    return this.prayers.loadGroupPrayers(groupId, silentRefresh);
  }

  loadGroupPrayersForPrint(groupId: string): Promise<PrayerRequest[]> {
    return this.prayers.loadGroupPrayersForPrint(groupId);
  }

  addGroupPrayer(groupId: string, payload: PrayerFormSubmitPayload): Promise<boolean> {
    return this.prayers.addGroupPrayer(groupId, payload);
  }

  addGroupPrayerUpdate(
    prayerId: string,
    content: string,
    author: string,
    authorEmail: string,
    markAsAnswered = false,
    groupIdHint?: string | null
  ): Promise<boolean> {
    return this.prayers.addGroupPrayerUpdate(
      prayerId,
      content,
      author,
      authorEmail,
      markAsAnswered,
      groupIdHint
    );
  }

  deleteGroupPrayer(prayerId: string, groupIdHint?: string | null): Promise<boolean> {
    return this.prayers.deleteGroupPrayer(prayerId, groupIdHint);
  }

  deleteGroupPrayerUpdate(
    updateId: string,
    prayerId: string,
    groupIdHint?: string | null
  ): Promise<boolean> {
    return this.prayers.deleteGroupPrayerUpdate(updateId, prayerId, groupIdHint);
  }

  /** @internal Used by unit tests to seed reactive state. */
  get groupsSubject() {
    return this.state.groupsSubject;
  }

  /** @internal Used by unit tests to seed reactive state. */
  get prayersSubject() {
    return this.state.prayersSubject;
  }

  /** @internal Used by unit tests to seed reactive state. */
  get prayerCountsSubject() {
    return this.state.prayerCountsSubject;
  }

  /** @internal Used by unit tests to set focused group. */
  get activeGroupId() {
    return this.state.activeGroupId;
  }

  /** @internal Used by unit tests to set focused group. */
  set activeGroupId(value: string | null) {
    this.state.activeGroupId = value;
  }

  /** @internal Used by unit tests to assert debounced resume refresh. */
  get resumeRefreshTimeoutId() {
    return this.state.resumeRefreshTimeoutId;
  }

  /** @internal Used by unit tests to assert debounced resume refresh. */
  set resumeRefreshTimeoutId(value: ReturnType<typeof setTimeout> | null) {
    this.state.resumeRefreshTimeoutId = value;
  }

  private refreshGroupBadgeCounts(): void {
    try {
      this.injector.get(GroupPrayerBadgeService).refreshBadgeCounts();
    } catch {
      // unit tests may omit GroupPrayerBadgeService
    }
  }
}
