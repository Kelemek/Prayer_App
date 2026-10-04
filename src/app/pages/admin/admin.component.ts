import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, distinctUntilChanged, filter, map, skip, take, takeUntil } from 'rxjs';
import { AdminDataService, type AdminData } from '../../services/admin-data.service';
import { UserSessionService } from '../../services/user-session.service';
import { AnalyticsService, type AnalyticsStats } from '../../services/analytics.service';
import {
  SendNotificationDialogComponent,
  type NotificationType,
} from '../../components/send-notification-dialog/send-notification-dialog.component';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import { AdminNavTilesComponent } from '../../components/admin-nav-tiles/admin-nav-tiles.component';
import { AdminApprovalsPanelComponent } from '../../components/admin-approvals-panel/admin-approvals-panel.component';
import { AdminDeletionsPanelComponent } from '../../components/admin-deletions-panel/admin-deletions-panel.component';
import { AdminAccountsPanelComponent } from '../../components/admin-accounts-panel/admin-accounts-panel.component';
import { AdminChurchBillingBannerComponent } from '../../components/admin-church-billing-banner/admin-church-billing-banner.component';
import { isChurchPlanTier, tenantHasChurchFeatures } from '../../lib/church-billing';
import {
  type AdminTab,
  type ConsolidatedApproval,
  buildConsolidatedApprovals,
  firstPendingTab,
  nextPendingTab,
} from '../../lib/admin-pending-queues';
import type { AdminSettingsTab } from '../../lib/admin-settings-tabs';
import { HelpModalComponent } from '../../components/help-modal/help-modal.component';
import type { HelpSection } from '../../types/help-content';
import { FeedbackService } from '../../services/feedback.service';
import { SupabaseService } from '../../services/supabase.service';
import { fetchPlanningCenterCredentialsStatus } from '../../lib/planning-center';
import { AdminHelpTourLauncher } from '../../services/admin-help-tour.launcher';
import { AdminHelpDriverTourService } from '../../services/admin-help-driver-tour.service';
import { ADMIN_HELP_TOUR_TIMING } from '../../lib/admin-help-tour-timing';
import { AdminHelpTourSettingsTabState } from '../../services/admin-help-tour-settings-tab-state.service';
import {
  AdminHelpTourHostAdapter,
  type AdminHelpTourHost,
} from '../../services/admin-help-tour-host.adapter';
import {
  hasSeenAdminIntroTour,
  markAdminIntroTourSeen,
} from '../../lib/admin-intro-tour-seen';
import { firstVisibleAdminSettingsTabForIntro } from '../../lib/admin-intro-tour-sections';
import type { AdminHelpTourVisibilityContext } from '../../lib/admin-help-tour-visibility';

const EMPTY_ANALYTICS_STATS: AnalyticsStats = {
  todayPageViews: 0,
  weekPageViews: 0,
  monthPageViews: 0,
  yearPageViews: 0,
  totalPageViews: 0,
  totalPrayers: 0,
  currentPrayers: 0,
  answeredPrayers: 0,
  archivedPrayers: 0,
  totalTenantMembers: 0,
  tenantLeadersAndAdmins: 0,
  memorizationTotal: 0,
  memorizationLearning: 0,
  memorizationPracticing: 0,
  memorizationMastered: 0,
  loading: false,
};

@Component({
  selector: 'app-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgComponentOutlet,
    AdminNavTilesComponent,
    AdminApprovalsPanelComponent,
    AdminDeletionsPanelComponent,
    AdminAccountsPanelComponent,
    AdminChurchBillingBannerComponent,
    SendNotificationDialogComponent,
    HelpModalComponent,
  ],
  providers: [AdminHelpTourLauncher, AdminHelpTourSettingsTabState],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit, OnDestroy {
  activeTab: AdminTab = 'prayers';
  activeSettingsTab: AdminSettingsTab = 'analytics';
  adminData: AdminData | null = null;
  consolidatedApprovals: ConsolidatedApproval[] = [];
  showHelp = false;
  showFeedbackForm = false;
  pcoCredentialsConfigured = false;
  private introAutoStartAttempted = false;
  /** True from intro auto-start until the intro is finished, dismissed, or aborted. */
  private introExperienceBlockingQueue = false;
  private readonly adminHelpTourHost: AdminHelpTourHost;
  analyticsStats: AnalyticsStats = { ...EMPTY_ANALYTICS_STATS };

  showSendNotificationDialog = false;
  sendDialogType: NotificationType = 'prayer';
  sendDialogPrayerTitle?: string;
  sendDialogPrayerId?: string;
  sendDialogUpdateId?: string;

  private destroy$ = new Subject<void>();
  private hasFetchStarted = false;
  isSuperAdmin = false;
  approvingAccountRequestId: string | null = null;
  denyingAccountRequestId: string | null = null;

  /** Loaded on first visit to Settings (large bundle). */
  settingsPanelComponent: Type<unknown> | null = null;
  settingsPanelLoading = false;
  settingsPanelLoadError = false;

  private settingsPanelLoad: Promise<void> | null = null;
  private pcoCredentialsRefreshGeneration = 0;
  private introAutoStartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private adminDataService: AdminDataService,
    private analyticsService: AnalyticsService,
    public userSessionService: UserSessionService,
    public tenantContextService: TenantContextService,
    private toastService: ToastService,
    private ngZone: NgZone,
    public cdr: ChangeDetectorRef,
    private readonly feedbackService: FeedbackService,
    private readonly supabaseService: SupabaseService,
    private readonly adminHelpTourLauncher: AdminHelpTourLauncher,
    private readonly adminHelpDriverTourService: AdminHelpDriverTourService,
  ) {
    this.adminHelpTourHost = new AdminHelpTourHostAdapter({
      closeHelp: () => this.closeHelp(),
      markForCheck: () => this.cdr.markForCheck(),
      getVisibilityContext: () => this.adminHelpTourVisibilityContext(),
      setMainTab: (tab) => this.onTabChange(tab),
      setSettingsTab: (tab) => this.onSettingsTabChange(tab),
      ensureSettingsLoaded: () => this.ensureSettingsPanelLoaded(),
      flushView: () => this.cdr.detectChanges(),
    });
  }

  ngOnInit(): void {
    this.adminHelpTourLauncher.bindHost(this.adminHelpTourHost);
    this.adminHelpTourLauncher.setMarkIntroSeenHandler(() => {
      this.introExperienceBlockingQueue = false;
      this.markIntroTourSeenForCurrentUser();
      this.resumeAdminWorkQueueAfterIntro();
    });

    void this.feedbackService.isConfigured().then((configured) => {
      this.showFeedbackForm = configured;
      this.cdr.markForCheck();
    });

    void this.refreshPcoCredentialsConfigured();

    void this.handleChurchCheckoutQuery();

    this.tenantContextService.loading$
      .pipe(
        filter((loading) => !loading),
        take(1),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.ensureSettingsTabAllowed();
        void this.refreshPcoCredentialsConfigured();
        this.cdr.markForCheck();
      });

    this.tenantContextService.activeTenant$
      .pipe(
        map((tenant) => tenant?.id ?? null),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        void this.refreshPcoCredentialsConfigured();
      });

    this.tenantContextService.isSuperAdmin$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isSuperAdmin) => {
        this.isSuperAdmin = isSuperAdmin;
        this.ensureSettingsTabAllowed();
        this.cdr.markForCheck();
      });

    this.tenantContextService.activeTenant$
      .pipe(
        map((tenant) => tenant?.id || null),
        distinctUntilChanged(),
        skip(1),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.ensureSettingsTabAllowed();
        this.adminDataService.fetchAdminData(true, true);
        if (this.activeTab === 'settings' && this.activeSettingsTab === 'analytics' && this.canAccessAnalytics()) {
          void this.loadAnalytics();
        }
      });

    this.adminDataService.data$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        this.ngZone.run(() => {
          this.adminData = data;
          this.consolidatedApprovals = this.buildConsolidatedApprovals(data);
          this.cdr.markForCheck();

          if (this.hasFetchStarted && !data.loading) {
            this.applyAdminExperienceAfterDataReady();
          }
        });
      });

    this.hasFetchStarted = true;
    if (!this.adminDataService.isInitialFetchInProgress()) {
      void this.adminDataService.fetchAdminData();
    }

    if (this.activeTab === 'settings' && this.activeSettingsTab === 'analytics' && this.canAccessAnalytics()) {
      void this.loadAnalytics();
    }
  }

  canAccessAnalytics(): boolean {
    if (this.tenantContextService.getIsSuperAdmin()) {
      return true;
    }
    return tenantHasChurchFeatures(this.tenantContextService.getActiveTenant());
  }

  isChurchTenant(): boolean {
    return isChurchPlanTier(this.tenantContextService.getActiveTenant());
  }

  adminHelpTourVisibilityContext(): AdminHelpTourVisibilityContext {
    return {
      showAnalyticsTab: this.canAccessAnalytics(),
      isChurchTenant: this.isChurchTenant(),
      showFeedbackForm: this.showFeedbackForm,
      pcoCredentialsConfigured: this.pcoCredentialsConfigured,
      canWipeChurch: this.canWipeChurch(),
    };
  }

  canManageChurchBilling(): boolean {
    if (this.isSuperAdmin) {
      return isChurchPlanTier(this.tenantContextService.getActiveTenant());
    }
    return this.tenantContextService.getActiveTenant()?.plan_tier === 'churches' &&
      this.tenantContextService.getMemberships().some(
        (m) =>
          m.tenant_id === this.tenantContextService.getActiveTenant()?.id &&
          m.role === 'tenant_admin'
      );
  }

  canWipeChurch(): boolean {
    const tenant = this.tenantContextService.getActiveTenant();
    if (!tenant || tenant.slug === 'default-tenant') {
      return false;
    }
    if (this.isSuperAdmin) {
      return true;
    }
    return this.tenantContextService.getMemberships().some(
      (m) => m.tenant_id === tenant.id && m.role === 'tenant_admin'
    );
  }

  private async handleChurchCheckoutQuery(): Promise<void> {
    const checkout = this.route.snapshot.queryParamMap.get('church_checkout');
    if (!checkout) return;

    if (checkout === 'success') {
      this.toastService.success('Church checkout completed. Refreshing your plan…');
      await this.tenantContextService.refresh();
    } else if (checkout === 'cancel') {
      this.toastService.info('Church checkout was canceled.');
    }

    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { church_checkout: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.cdr.markForCheck();
  }

  private ensureSettingsTabAllowed(): void {
    if (!this.isSuperAdmin && this.activeSettingsTab === 'tenant_manager') {
      this.activeSettingsTab = 'security';
    }
    if (!this.canAccessAnalytics() && this.activeSettingsTab === 'analytics') {
      this.activeSettingsTab = 'content';
    }
  }

  private setInitialTab(): void {
    if (!this.adminData) return;
    this.onTabChange(firstPendingTab(this.adminData));
  }

  private autoProgressTabs(): void {
    if (!this.adminData) return;
    const next = nextPendingTab(this.activeTab, this.adminData);
    if (next !== this.activeTab) {
      this.onTabChange(next);
    }
  }

  async loadAnalytics(): Promise<void> {
    const tenantId = this.tenantContextService.getActiveTenant()?.id;
    this.analyticsStats.loading = true;
    this.cdr.markForCheck();
    if (!tenantId) {
      this.analyticsStats = { ...EMPTY_ANALYTICS_STATS };
      this.cdr.markForCheck();
      return;
    }
    try {
      this.analyticsStats = await this.analyticsService.getStats(tenantId);
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      this.analyticsStats.loading = false;
      this.cdr.markForCheck();
    }
  }

  onTabChange(tab: AdminTab): void {
    this.activeTab = tab;
    if (tab === 'settings') {
      void this.ensureSettingsPanelLoaded();
    }
    if (tab === 'settings' && this.activeSettingsTab === 'analytics' && this.canAccessAnalytics()) {
      void this.loadAnalytics();
    }
  }

  onSettingsTabChange(tab: AdminSettingsTab): void {
    const next = tab === 'analytics' && !this.canAccessAnalytics() ? 'content' : tab;
    this.activeSettingsTab = next;
    void this.ensureSettingsPanelLoaded();
    if (next === 'analytics') {
      void this.loadAnalytics();
    }
    this.cdr.markForCheck();
  }

  readonly settingsPanelInputs = (): Record<string, unknown> => ({
    activeSettingsTab: this.activeSettingsTab,
    analyticsStats: this.analyticsStats,
    showAnalyticsTab: this.canAccessAnalytics(),
    isChurchTenant: this.isChurchTenant(),
    isSuperAdmin: this.isSuperAdmin,
    canWipeChurch: this.canWipeChurch(),
    activeTenant: this.tenantContextService.getActiveTenant(),
    settingsTabChangeHandler: (tab: AdminSettingsTab) => this.onSettingsTabChange(tab),
    pcoCredentialsConfigured: this.pcoCredentialsConfigured,
    pcoCredentialsConfiguredChangeHandler: (configured: boolean) => {
      this.pcoCredentialsConfigured = configured;
      this.cdr.markForCheck();
    },
  });

  private async refreshPcoCredentialsConfigured(): Promise<void> {
    if (!this.isChurchTenant()) {
      this.pcoCredentialsConfigured = false;
      this.cdr.markForCheck();
      return;
    }
    const tenantId = this.tenantContextService.getActiveTenant()?.id;
    if (!tenantId) {
      this.pcoCredentialsConfigured = false;
      this.cdr.markForCheck();
      return;
    }
    const generation = ++this.pcoCredentialsRefreshGeneration;
    const { status, error } = await fetchPlanningCenterCredentialsStatus(
      this.supabaseService.client,
      tenantId
    );
    if (generation !== this.pcoCredentialsRefreshGeneration) {
      return;
    }
    if (this.tenantContextService.getActiveTenant()?.id !== tenantId) {
      return;
    }
    if (error) {
      this.pcoCredentialsConfigured = false;
      this.cdr.markForCheck();
      return;
    }
    this.pcoCredentialsConfigured = Boolean(status?.configured);
    this.cdr.markForCheck();
  }

  openHelp(): void {
    this.showHelp = true;
    this.cdr.markForCheck();
  }

  closeHelp(): void {
    this.showHelp = false;
    this.cdr.markForCheck();
  }

  onHelpSectionTour(section: HelpSection): void {
    this.clearIntroAutoStartTimer();
    const introWasActive = this.adminHelpDriverTourService.isIntroChainActive();
    this.adminHelpTourLauncher.startSectionTour(section);
    if (introWasActive && this.shouldOfferIntroTour()) {
      this.introExperienceBlockingQueue = false;
    }
  }

  onFullAdminGuidedTour(_sections: HelpSection[]): void {
    this.clearIntroAutoStartTimer();
    this.introAutoStartAttempted = true;
    this.introExperienceBlockingQueue = true;
    this.adminHelpTourLauncher.startIntroGuidedTour(_sections);
  }

  private shouldOfferIntroTour(): boolean {
    const tenantId = this.tenantContextService.getActiveTenant()?.id;
    const email = this.userSessionService.getCurrentSession()?.email;
    if (!tenantId || !email?.trim()) {
      return false;
    }
    return !hasSeenAdminIntroTour(tenantId, email);
  }

  private markIntroTourSeenForCurrentUser(): void {
    const tenantId = this.tenantContextService.getActiveTenant()?.id;
    const email = this.userSessionService.getCurrentSession()?.email;
    if (tenantId && email?.trim()) {
      markAdminIntroTourSeen(tenantId, email);
    }
  }

  /** After first-visit intro ends or is dismissed, restore pending-queue tab navigation. */
  private resumeAdminWorkQueueAfterIntro(): void {
    if (!this.adminData) {
      return;
    }
    const target = firstPendingTab(this.adminData);
    if (target !== this.activeTab) {
      this.onTabChange(target);
    }
    this.autoProgressTabs();
    this.cdr.markForCheck();
  }

  private releaseIntroQueueBlockAndResumeWork(): void {
    if (!this.introExperienceBlockingQueue) {
      return;
    }
    this.introExperienceBlockingQueue = false;
    this.resumeAdminWorkQueueAfterIntro();
  }

  private async maybeStartIntroTour(): Promise<void> {
    if (this.introAutoStartAttempted || !this.shouldOfferIntroTour()) {
      return;
    }
    this.introAutoStartAttempted = true;
    this.introExperienceBlockingQueue = true;
    await this.refreshPcoCredentialsConfigured();
    if (!this.shouldOfferIntroTour()) {
      this.releaseIntroQueueBlockAndResumeWork();
      return;
    }
    this.activeTab = 'settings';
    this.activeSettingsTab = firstVisibleAdminSettingsTabForIntro({
      showAnalyticsTab: this.canAccessAnalytics(),
    });
    await this.ensureSettingsPanelLoaded();
    if (this.activeSettingsTab === 'analytics' && this.canAccessAnalytics()) {
      await this.loadAnalytics();
    }
    this.cdr.markForCheck();
    this.clearIntroAutoStartTimer();
    this.introAutoStartTimer = window.setTimeout(() => {
      this.introAutoStartTimer = null;
      if (!this.shouldOfferIntroTour()) {
        this.releaseIntroQueueBlockAndResumeWork();
        return;
      }
      this.adminHelpTourLauncher.tryAutoStartIntroTour();
    }, ADMIN_HELP_TOUR_TIMING.launcherStartDelayMs);
  }

  private clearIntroAutoStartTimer(): void {
    if (this.introAutoStartTimer != null) {
      clearTimeout(this.introAutoStartTimer);
      this.introAutoStartTimer = null;
    }
  }

  retrySettingsPanel(): void {
    this.settingsPanelLoadError = false;
    this.settingsPanelLoad = null;
    void this.ensureSettingsPanelLoaded();
  }

  private async ensureSettingsPanelLoaded(): Promise<void> {
    if (this.settingsPanelComponent) {
      return;
    }
    if (this.settingsPanelLoad) {
      await this.settingsPanelLoad;
      return;
    }
    this.settingsPanelLoading = true;
    this.settingsPanelLoadError = false;
    this.cdr.markForCheck();
    const load = import(
      '../../components/admin-settings-panel/admin-settings-panel.component'
    )
      .then((module) => {
        this.settingsPanelComponent = module.AdminSettingsPanelComponent;
      })
      .catch((error: unknown) => {
        console.error('Failed to load settings panel:', error);
        this.settingsPanelLoadError = true;
        if (this.settingsPanelLoad === load) {
          this.settingsPanelLoad = null;
        }
      })
      .finally(() => {
        if (this.settingsPanelLoad === load || this.settingsPanelLoad === null) {
          this.settingsPanelLoading = false;
        }
        this.cdr.markForCheck();
      });
    this.settingsPanelLoad = load;
    return load;
  }

  ngOnDestroy(): void {
    this.clearIntroAutoStartTimer();
    this.adminHelpDriverTourService.interruptTours();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Intro tour on first visit, otherwise pending-queue tab auto-progress. */
  private applyAdminExperienceAfterDataReady(): void {
    if (this.shouldOfferIntroTour() && !this.introAutoStartAttempted) {
      void this.maybeStartIntroTour();
      return;
    }
    if (
      this.introExperienceBlockingQueue ||
      this.adminHelpDriverTourService.isIntroChainActive()
    ) {
      return;
    }
    if (this.activeTab === 'prayers') {
      this.setInitialTab();
    }
    this.autoProgressTabs();
  }

  get totalPendingCount(): number {
    if (!this.adminData) return 0;
    return (
      (this.consolidatedApprovals?.length || 0) +
      (this.adminData.pendingDeletionRequests?.length || 0) +
      (this.adminData.pendingUpdateDeletionRequests?.length || 0) +
      (this.adminData.pendingAccountRequests?.length || 0)
    );
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  refresh(): void {
    this.adminDataService.refresh();
  }

  async approvePrayer(id: string): Promise<void> {
    await this.runReviewAction(
      () => this.adminDataService.approvePrayer(id),
      'Error approving prayer:',
      () => this.openSendNotificationDialog('prayer', id),
    );
  }

  async denyPrayer(id: string, reason: string): Promise<void> {
    await this.runReviewAction(
      () => this.adminDataService.denyPrayer(id, reason),
      'Error denying prayer:',
    );
  }

  async editPrayer(id: string, updates: Record<string, unknown>): Promise<void> {
    try {
      await this.adminDataService.editPrayer(id, updates);
      this.adminDataService.refresh();
    } catch (error) {
      console.error('Error editing prayer:', error);
    }
  }

  handlePrayerEdited(_id: string): void {
    this.adminDataService.refresh();
  }

  handleUpdateEdited(_id: string): void {
    this.adminDataService.refresh();
  }

  async approveUpdate(id: string): Promise<void> {
    await this.runReviewAction(
      () => this.adminDataService.approveUpdate(id),
      'Error approving update:',
      () => this.openSendNotificationDialog('update', id),
    );
  }

  async denyUpdate(id: string, reason: string): Promise<void> {
    await this.runReviewAction(
      () => this.adminDataService.denyUpdate(id, reason),
      'Error denying update:',
    );
  }

  async editUpdate(id: string, updates: Record<string, unknown>): Promise<void> {
    try {
      await this.adminDataService.editUpdate(id, updates);
      this.sendDialogUpdateId = id;
      let title = updates?.['prayer_title'] as string | undefined;
      if (!title) {
        const update = this.adminData?.pendingUpdates?.find((u) => u.id === id);
        if (update) {
          title = update.prayer_title || update.prayers?.title;
        }
      }
      this.sendDialogPrayerTitle = title;
      this.sendDialogType = 'update';
      this.showSendNotificationDialog = true;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error editing update:', error);
    }
  }

  async approveDeletionRequest(id: string): Promise<void> {
    await this.runReviewAction(
      () => this.adminDataService.approveDeletionRequest(id),
      'Error approving deletion request:',
    );
  }

  async denyDeletionRequest(id: string, reason: string): Promise<void> {
    await this.runReviewAction(
      () => this.adminDataService.denyDeletionRequest(id, reason),
      'Error denying deletion request:',
    );
  }

  async approveUpdateDeletionRequest(id: string): Promise<void> {
    await this.runReviewAction(
      () => this.adminDataService.approveUpdateDeletionRequest(id),
      'Error approving update deletion request:',
    );
  }

  async denyUpdateDeletionRequest(id: string, reason: string): Promise<void> {
    await this.runReviewAction(
      () => this.adminDataService.denyUpdateDeletionRequest(id, reason),
      'Error denying update deletion request:',
    );
  }

  buildConsolidatedApprovals(data: AdminData | null | undefined | Record<string, unknown>): ConsolidatedApproval[] {
    return buildConsolidatedApprovals(data as AdminData | null | undefined);
  }

  trackByPrayerId(_index: number, prayer: { id: string }): string {
    return prayer.id;
  }

  trackByUpdateId(_index: number, update: { id: string }): string {
    return update.id;
  }

  trackByDeletionRequestId(_index: number, request: { id: string }): string {
    return request.id;
  }

  trackByAccountRequestId(_index: number, request: { id: string }): string {
    return request.id;
  }

  async approveAccountRequest(requestId: string): Promise<void> {
    this.approvingAccountRequestId = requestId;
    this.cdr.markForCheck();
    try {
      await this.runReviewAction(
        () => this.adminDataService.approveAccountRequest(requestId),
        'Error approving account request:',
        () => this.cdr.markForCheck(),
      );
    } finally {
      this.approvingAccountRequestId = null;
      this.cdr.markForCheck();
    }
  }

  async denyAccountRequest(requestId: string, reason: string): Promise<void> {
    this.denyingAccountRequestId = requestId;
    this.cdr.markForCheck();
    try {
      await this.runReviewAction(
        () => this.adminDataService.denyAccountRequest(requestId, reason),
        'Error denying account request:',
        () => this.cdr.markForCheck(),
      );
    } finally {
      this.denyingAccountRequestId = null;
      this.cdr.markForCheck();
    }
  }

  async onConfirmSendNotification(): Promise<void> {
    try {
      if (this.sendDialogType === 'prayer' && this.sendDialogPrayerId) {
        const prayerId = this.sendDialogPrayerId;
        const prayer =
          this.adminData?.pendingPrayers?.find((p) => p.id === prayerId) ||
          this.adminData?.approvedPrayers?.find((p) => p.id === prayerId);
        if (prayer?.approval_status === 'approved') {
          await this.adminDataService.sendApprovedPrayerEmails(prayerId);
        } else {
          await this.adminDataService.sendBroadcastNotificationForNewPrayer(prayerId);
        }
      } else if (this.sendDialogType === 'update' && this.sendDialogUpdateId) {
        const updateId = this.sendDialogUpdateId;
        const update =
          this.adminData?.pendingUpdates?.find((u) => u.id === updateId) ||
          this.adminData?.approvedUpdates?.find((u) => u.id === updateId);
        if (update?.approval_status === 'approved') {
          await this.adminDataService.sendApprovedUpdateEmails(updateId);
        } else {
          await this.adminDataService.sendBroadcastNotificationForNewUpdate(updateId);
        }
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    } finally {
      this.onDeclineSendNotification();
    }
  }

  onDeclineSendNotification(): void {
    this.showSendNotificationDialog = false;
    this.sendDialogPrayerId = undefined;
    this.sendDialogUpdateId = undefined;
    this.sendDialogPrayerTitle = undefined;
    this.cdr.markForCheck();
  }

  private async runReviewAction(
    action: () => Promise<void>,
    errorLabel: string,
    after?: () => void,
  ): Promise<void> {
    try {
      await action();
      after?.();
      this.autoProgressTabs();
    } catch (error) {
      console.error(errorLabel, error);
      const message = error instanceof Error && error.message
        ? error.message
        : 'Could not complete that review action';
      this.toastService.error(message);
    }
  }

  private openSendNotificationDialog(type: 'prayer' | 'update', id: string): void {
    if (type === 'prayer') {
      this.sendDialogPrayerId = id;
      this.sendDialogPrayerTitle = this.adminData?.pendingPrayers?.find((p) => p.id === id)?.title;
    } else {
      this.sendDialogUpdateId = id;
      const update = this.adminData?.pendingUpdates?.find((u) => u.id === id);
      this.sendDialogPrayerTitle = update?.prayer_title || update?.prayers?.title;
    }
    this.sendDialogType = type;
    this.showSendNotificationDialog = true;
    this.cdr.markForCheck();
  }
}
