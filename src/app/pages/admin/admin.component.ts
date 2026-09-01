import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, distinctUntilChanged, filter, map, skip, take, takeUntil } from 'rxjs';
import { AdminDataService, type AdminData } from '../../services/admin-data.service';
import { AdminAuthService } from '../../services/admin-auth.service';
import { UserSessionService } from '../../services/user-session.service';
import { AnalyticsService, type AnalyticsStats } from '../../services/analytics.service';
import {
  SendNotificationDialogComponent,
  type NotificationType,
} from '../../components/send-notification-dialog/send-notification-dialog.component';
import { GitHubFeedbackService } from '../../services/github-feedback.service';
import { ConfirmationDialogComponent } from '../../components/confirmation-dialog/confirmation-dialog.component';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import type { Tenant } from '../../types/tenant';
import { AdminNavTilesComponent } from '../../components/admin-nav-tiles/admin-nav-tiles.component';
import { AdminApprovalsPanelComponent } from '../../components/admin-approvals-panel/admin-approvals-panel.component';
import { AdminDeletionsPanelComponent } from '../../components/admin-deletions-panel/admin-deletions-panel.component';
import { AdminAccountsPanelComponent } from '../../components/admin-accounts-panel/admin-accounts-panel.component';
import { AdminSettingsPanelComponent } from '../../components/admin-settings-panel/admin-settings-panel.component';
import {
  type AdminTab,
  type ConsolidatedApproval,
  buildConsolidatedApprovals,
  firstPendingTab,
  nextPendingTab,
} from '../../lib/admin-pending-queues';
import type { AdminSettingsTab } from '../../lib/admin-settings-tabs';

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
    AdminNavTilesComponent,
    AdminApprovalsPanelComponent,
    AdminDeletionsPanelComponent,
    AdminAccountsPanelComponent,
    AdminSettingsPanelComponent,
    SendNotificationDialogComponent,
    ConfirmationDialogComponent,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit, OnDestroy {
  activeTab: AdminTab = 'prayers';
  activeSettingsTab: AdminSettingsTab = 'analytics';
  adminData: AdminData | null = null;
  consolidatedApprovals: ConsolidatedApproval[] = [];
  showLogoutConfirmation = false;
  analyticsStats: AnalyticsStats = { ...EMPTY_ANALYTICS_STATS };

  showSendNotificationDialog = false;
  sendDialogType: NotificationType = 'prayer';
  sendDialogPrayerTitle?: string;
  sendDialogPrayerId?: string;
  sendDialogUpdateId?: string;

  private destroy$ = new Subject<void>();
  private hasFetchStarted = false;
  isSuperAdmin = false;
  githubFeedbackEnabled = false;
  tenantContextLoading = true;
  approvingAccountRequestId: string | null = null;
  denyingAccountRequestId: string | null = null;

  constructor(
    private router: Router,
    private adminDataService: AdminDataService,
    private analyticsService: AnalyticsService,
    public adminAuthService: AdminAuthService,
    public userSessionService: UserSessionService,
    private tenantContextService: TenantContextService,
    private githubFeedbackService: GitHubFeedbackService,
    private toastService: ToastService,
    private ngZone: NgZone,
    public cdr: ChangeDetectorRef,
  ) {}

  @HostListener('document:click')
  @HostListener('document:keypress')
  @HostListener('document:mousemove')
  @HostListener('document:touchstart')
  recordActivity(): void {
    this.adminAuthService.recordActivity();
  }

  ngOnInit(): void {
    void this.loadGitHubFeedbackStatus();

    this.tenantContextService.loading$
      .pipe(
        filter((loading) => !loading),
        take(1),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.ensureSettingsTabAllowed();
        this.cdr.markForCheck();
      });

    this.tenantContextService.isSuperAdmin$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isSuperAdmin) => {
        this.isSuperAdmin = isSuperAdmin;
        this.ensureSettingsTabAllowed();
        this.cdr.markForCheck();
      });

    this.tenantContextService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.tenantContextLoading = loading;
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

          if (this.activeTab === 'prayers' && this.hasFetchStarted && !data.loading) {
            this.setInitialTab();
          }

          if (this.hasFetchStarted && !data.loading) {
            this.autoProgressTabs();
          }
        });
      });

    this.hasFetchStarted = true;
    this.adminDataService.fetchAdminData();

    if (this.activeTab === 'settings' && this.activeSettingsTab === 'analytics' && this.canAccessAnalytics()) {
      void this.loadAnalytics();
    }
  }

  async loadGitHubFeedbackStatus(): Promise<void> {
    try {
      const config = await this.githubFeedbackService.getGitHubConfig();
      this.githubFeedbackEnabled = config?.enabled ?? false;
    } catch (err) {
      console.error('[Admin] Error loading GitHub feedback status:', err);
      this.githubFeedbackEnabled = false;
    } finally {
      this.cdr.markForCheck();
    }
  }

  canAccessAnalytics(): boolean {
    if (this.tenantContextService.getIsSuperAdmin()) {
      return true;
    }
    return this.tenantContextService.getActiveTenant()?.plan_tier === 'churches';
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
    if (tab === 'settings' && this.activeSettingsTab === 'analytics' && this.canAccessAnalytics()) {
      void this.loadAnalytics();
    }
  }

  onSettingsTabChange(tab: AdminSettingsTab): void {
    const next = tab === 'analytics' && !this.canAccessAnalytics() ? 'content' : tab;
    this.activeSettingsTab = next;
    if (next === 'analytics') {
      void this.loadAnalytics();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  async handleLogout(): Promise<void> {
    this.showLogoutConfirmation = false;
    this.cdr.markForCheck();
    await this.adminAuthService.logout();
  }

  get activeTenantId(): string | null {
    return this.tenantContextService.getActiveTenant()?.id ?? null;
  }

  get showTenantSwitcher(): boolean {
    return (
      !this.tenantContextLoading &&
      !!this.activeTenantId &&
      this.tenantSwitchOptions.length > 1
    );
  }

  get tenantSwitchOptions(): Tenant[] {
    const options = this.tenantContextService.getTenantSwitcherOptions();
    const unique = new Map(options.map((tenant) => [tenant.id, tenant]));
    const activeTenant = this.tenantContextService.getActiveTenant();
    if (activeTenant?.id && !unique.has(activeTenant.id)) {
      unique.set(activeTenant.id, activeTenant);
    }

    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
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
