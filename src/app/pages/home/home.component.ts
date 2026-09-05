import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Router, ActivatedRoute } from "@angular/router";
import type { CdkDragDrop } from "@angular/cdk/drag-drop";
import { PrayerFormComponent } from "../../components/prayer-form/prayer-form.component";
import {
  PrayerFiltersComponent,
  PrayerFilters,
} from "../../components/prayer-filters/prayer-filters.component";
import { SkeletonLoaderComponent } from "../../components/skeleton-loader/skeleton-loader.component";
import {
  PrayerService,
  PrayerRequest,
  PrayerUpdate,
} from "../../services/prayer.service";
import { PromptService } from "../../services/prompt.service";
import { AdminAuthService } from "../../services/admin-auth.service";
import { UserSessionService, type UserSessionData } from "../../services/user-session.service";
import { SupabaseService } from "../../services/supabase.service";
import { BadgeService } from "../../services/badge.service";
import { Observable, Subject, takeUntil } from "rxjs";
import { ToastService } from "../../services/toast.service";
import { PersonalCategoryColorService } from "../../services/personal-category-color.service";
import { AnalyticsService } from "../../services/analytics.service";
import { PullToRefreshDirective } from "../../directives/pull-to-refresh.directive";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { TenantPermissionService } from "../../services/tenant-permission.service";
import { TenantContextService } from "../../services/tenant-context.service";
import { UserSubscriptionService } from "../../services/user-subscription.service";
import { ProCheckoutService } from "../../services/pro-checkout.service";
import { PrayerGroupService } from "../../services/prayer-group.service";
import type { PrayerGroup } from "../../types/prayer-group";
import { ConnectivityService } from "../../services/connectivity.service";
import { MemorizationService } from "../../services/memorization.service";
import { MemorizationRecommendationsService } from "../../services/memorization-recommendations.service";
import { ScriptureService } from "../../services/scripture.service";
import {
  PROMPT_TYPE_CHIP_ACTIVE_CLASS,
  PROMPT_TYPE_CHIP_INACTIVE_CLASS,
} from "../../lib/prompt-type-chip-classes";
import {
  PERSONAL_PRAYER_WALKTHROUGH_DESCRIPTION,
  PERSONAL_PRAYER_WALKTHROUGH_PRAYER_FOR,
} from "../../services/help-driver-tour.service";
import {
  BRANDING_CACHE_KEYS,
  getBrandingCacheKey,
} from "../../utils/branding-cache-keys";
import type { Tenant, TenantMembership } from "../../types/tenant";
import {
  parseHomeReturnContextFromState,
  HOME_RETURN_CONTEXT_STATE_KEY,
  type HomeReturnContext,
} from "../../types/presentation";

import { HomeDeepLinkCoordinator } from "../../services/home-deep-link.coordinator";
import type { HomeDeepLinkHostAdapter } from "../../services/home-deep-link-host.adapter";
import { HomeCatalogStore } from "../../services/home-catalog.store";
import { HomeFilterCoordinator } from "../../services/home-filter.coordinator";
import { HomePersonalCategoryController } from "../../services/home-personal-category.controller";
import { HomeMemorizationPanelController } from "../../services/home-memorization-panel.controller";
import { HomeLifecycleCoordinator } from "../../services/home-lifecycle.coordinator";
import { HomeModalController } from "../../services/home-modal.controller";
import { HomeRefreshCoordinator } from "../../services/home-refresh.coordinator";
import { PresentationHomeHandoffCoordinator } from "../../services/presentation-home-handoff.coordinator";
import { HomePrayerCardActionsController } from "../../services/home-prayer-card-actions.controller";
import { HomePresentationNavigationController } from "../../services/home-presentation-navigation.controller";
import { HomeAdminNavigationController } from "../../services/home-admin-navigation.controller";
import { HomeHelpTourLauncher } from "../../services/home-help-tour.launcher";
import {
  createHomeCatalogBindings,
  readHomeFilteredPersonalPrayers,
  syncHomeCatalog,
  wireHomeCoordinators,
  type HomeCoordinatorWiringPage,
} from "../../services/home-coordinator-wiring";
import type { HomeLifecyclePageBindings } from "../../services/home-lifecycle-host.adapter";
import { updateHomeDefaultViewPreference } from "../../lib/home-default-view-preference";
import type { HomeActiveFilter } from "../../services/home-deep-link-host.adapter";
import { isPublicAreaFilter, isPublicTabFilter, isCommunityPrayerFilter } from "../../lib/home-community-filter";
import { HOME_SHELL_FOOTER_BORDER_TOP_CLASS } from "../../lib/home-sub-filter-chip-classes";
import { HomeHeaderComponent } from "../../components/home-header/home-header.component";
import { HomeModalsHostComponent } from "../../components/home-modals-host/home-modals-host.component";
import { HomeFilterTabsComponent } from "../../components/home-filter-tabs/home-filter-tabs.component";
import { HomePublicStatusFiltersComponent } from "../../components/home-public-status-filters/home-public-status-filters.component";
import { HomePromptTypeFiltersComponent } from "../../components/home-prompt-type-filters/home-prompt-type-filters.component";
import { HomePersonalCategoryFiltersComponent } from "../../components/home-personal-category-filters/home-personal-category-filters.component";
import { HomeGroupFiltersComponent } from "../../components/home-group-filters/home-group-filters.component";
import { HomeGroupEditorModalComponent } from "../../components/home-group-editor-modal/home-group-editor-modal.component";
import { HomePrayerContentComponent } from "../../components/home-prayer-content/home-prayer-content.component";
import { ScrollToTopButtonComponent } from "../../components/scroll-to-top-button/scroll-to-top-button.component";
import type { PrayerPrompt } from "../../components/prompt-card/prompt-card.component";
import type { MemorizedItem } from "../../types/memorization";
import {
  createHomePageShell,
  type HomePageShell,
} from "../../lib/home-page-shell";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HomeHeaderComponent,
    HomeModalsHostComponent,
    HomeFilterTabsComponent,
    HomePublicStatusFiltersComponent,
    HomePromptTypeFiltersComponent,
    HomePersonalCategoryFiltersComponent,
    HomeGroupFiltersComponent,
    HomeGroupEditorModalComponent,
    HomePrayerContentComponent,
    ScrollToTopButtonComponent,
    PrayerFiltersComponent,
    SkeletonLoaderComponent,
    PullToRefreshDirective,
    ScrollingModule,
  ],
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.css",
  providers: [
    HomeDeepLinkCoordinator,
    HomeHelpTourLauncher,
    HomeCatalogStore,
    HomeFilterCoordinator,
    HomePersonalCategoryController,
    HomeMemorizationPanelController,
    HomeLifecycleCoordinator,
    HomeModalController,
    HomeRefreshCoordinator,
    PresentationHomeHandoffCoordinator,
    HomeAdminNavigationController,
    HomePrayerCardActionsController,
    HomePresentationNavigationController,
  ],
})
export class HomeComponent
  implements OnInit, OnDestroy, HomeCoordinatorWiringPage, HomeLifecyclePageBindings
{
  prayers$!: Observable<PrayerRequest[]>;
  prompts$!: Observable<PrayerPrompt[]>;
  loading$!: Observable<boolean>;
  error$!: Observable<string | null>;
  isAdmin$!: Observable<boolean>;
  hasAdminEmail$!: Observable<boolean>;

  currentPrayers: PrayerRequest[] = [];
  personalPrayers: PrayerRequest[] = [];

  currentPrayerBadge$!: Observable<number>;
  answeredPrayerBadge$!: Observable<number>;
  promptBadge$!: Observable<number>;

  currentPrayersCount = 0;
  answeredPrayersCount = 0;
  archivedPrayersCount = 0;
  totalPrayersCount = 0;
  promptsCount = 0;
  personalPrayersCount = 0;

  filters: PrayerFilters = { status: "current" };
  isRefreshing = false;
  hasLogo = false;
  activeFilter: HomeActiveFilter = "current";
  viewReady = false;
  pendingHomeReturnContext: HomeReturnContext | null = null;
  selectedPromptTypes: string[] = [];
  lastExplicitRefreshAt = 0;
  isOnline = true;
  isAdmin = false;
  canAccessShared = false;
  canAccessGroupsTab = false;
  prayerGroups: PrayerGroup[] = [];
  selectedGroupId: string | null = null;
  showGroupEditor = false;
  groupEditorSubmitting = false;
  membersGroupIdToOpen: string | null = null;
  groupPrayers: PrayerRequest[] = [];
  tenantMemberships: TenantMembership[] = [];
  availableTenants: Tenant[] = [];
  tenantContextLoading = true;
  personalCategoryPickerPrayerId: string | null = null;

  memorizedItems: MemorizedItem[] = [];
  memorizedItemsCount = 0;
  memorizedLearning: MemorizedItem[] = [];
  memorizedPracticing: MemorizedItem[] = [];
  memorizedMastered: MemorizedItem[] = [];
  memorizationRecommendationOwnedKeys = new Set<string>();

  deletionsAllowed: "everyone" | "original-requestor" | "admin-only" =
    "everyone";
  updatesAllowed: "everyone" | "original-requestor" | "admin-only" = "everyone";

  readonly promptTypeActiveClass = PROMPT_TYPE_CHIP_ACTIVE_CLASS;
  readonly promptTypeInactiveClass = PROMPT_TYPE_CHIP_INACTIVE_CLASS;
  readonly personalWalkthroughPrayerFor = PERSONAL_PRAYER_WALKTHROUGH_PRAYER_FOR;
  readonly personalWalkthroughDescription =
    PERSONAL_PRAYER_WALKTHROUGH_DESCRIPTION;
  readonly isPublicTabFilter = isPublicTabFilter;
  readonly isPublicAreaFilter = isPublicAreaFilter;
  readonly bottomSafeBarClass = `bottom-safe-bar w-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-md ${HOME_SHELL_FOOTER_BORDER_TOP_CLASS} sticky bottom-0 z-50`;

  readonly shell: HomePageShell;
  readonly memberCardActions: HomePrayerCardActionsController;

  private destroy$ = new Subject<void>();
  private deepLinkHost!: HomeDeepLinkHostAdapter;

  @ViewChild("modalsHost") private modalsHost?: HomeModalsHostComponent;
  @ViewChild("safeAreaViewport") safeAreaViewport!: ElementRef<HTMLElement>;
  @ViewChild(HomePrayerContentComponent)
  private prayerContent?: HomePrayerContentComponent;
  @ViewChild("memorizeKeyboardBridge")
  private memorizeKeyboardBridge?: ElementRef<HTMLInputElement>;

  get canAccessAdminFeatures(): boolean {
    return this.tenantPermissionService.canAccessAdmin();
  }

  get activeTenantId(): string | null {
    return this.tenantContextService.getActiveTenant()?.id ?? null;
  }

  get isSuperAdmin(): boolean {
    return this.tenantContextService.getIsSuperAdmin();
  }

  get showTenantSwitcher(): boolean {
    return (
      !this.tenantContextLoading &&
      !!this.activeTenantId &&
      this.tenantSwitchOptions.length > 1
    );
  }

  get tenantSwitchOptions(): Tenant[] {
    const ctx = this.tenantContextService;
    const options = ctx.getTenantSwitcherOptions();
    const unique = new Map(options.map((tenant) => [tenant.id, tenant]));
    const activeTenant = ctx.getActiveTenant();
    if (activeTenant?.id && !unique.has(activeTenant.id)) {
      unique.set(activeTenant.id, activeTenant);
    }

    return Array.from(unique.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  constructor(
    public prayerService: PrayerService,
    public promptService: PromptService,
    public adminAuthService: AdminAuthService,
    public userSessionService: UserSessionService,
    public badgeService: BadgeService,
    public memorizationService: MemorizationService,
    public memorizationRecommendationsService: MemorizationRecommendationsService,
    private scriptureService: ScriptureService,
    private toastService: ToastService,
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private tenantPermissionService: TenantPermissionService,
    private tenantContextService: TenantContextService,
    public prayerGroupService: PrayerGroupService,
    private userSubscriptionService: UserSubscriptionService,
    private proCheckoutService: ProCheckoutService,
    private connectivity: ConnectivityService,
    private personalCategoryColorService: PersonalCategoryColorService,
    private readonly deepLinkCoordinator: HomeDeepLinkCoordinator,
    readonly helpTour: HomeHelpTourLauncher,
    readonly catalog: HomeCatalogStore,
    readonly filter: HomeFilterCoordinator,
    readonly personalCategory: HomePersonalCategoryController,
    readonly memorizationPanel: HomeMemorizationPanelController,
    private readonly lifecycleCoordinator: HomeLifecycleCoordinator,
    readonly modals: HomeModalController,
    readonly refresh: HomeRefreshCoordinator,
    readonly presentationNav: HomePresentationNavigationController,
    readonly adminNav: HomeAdminNavigationController,
    readonly prayerCardActions: HomePrayerCardActionsController
  ) {
    this.memberCardActions = this.prayerCardActions;

    const windowCache = (window as { __cachedLogos?: { tenantId?: string | null; useLogo?: boolean } }).__cachedLogos;
    const tenantId = localStorage.getItem("active_tenant_id");
    const windowCacheApplies =
      !!windowCache &&
      (!tenantId || !windowCache.tenantId || windowCache.tenantId === tenantId);
    const useLogoKey = getBrandingCacheKey(BRANDING_CACHE_KEYS.useLogo, tenantId);
    const useLogoStored = localStorage.getItem(useLogoKey);
    const useLogo =
      useLogoStored !== null
        ? useLogoStored === "true"
        : windowCacheApplies && windowCache?.useLogo === true;
    this.hasLogo = useLogo;

    const wired = wireHomeCoordinators({
      page: this,
      filterPage: this,
      lifecyclePage: this,
      cdr: this.cdr,
      router: this.router,
      route: this.route,
      prayerService: this.prayerService,
      promptService: this.promptService,
      adminAuthService: this.adminAuthService,
      userSessionService: this.userSessionService,
      badgeService: this.badgeService,
      memorizationService: this.memorizationService,
      memorizationRecommendationsService: this.memorizationRecommendationsService,
      scriptureService: this.scriptureService,
      personalCategoryColorService: this.personalCategoryColorService,
      toastService: this.toastService,
      analyticsService: this.analyticsService,
      tenantContextService: this.tenantContextService,
      tenantPermissionService: this.tenantPermissionService,
      connectivity: this.connectivity,
      prayerGroupService: this.prayerGroupService,
      supabaseService: this.supabaseService,
      prayerCardActions: this.prayerCardActions,
      deepLinkCoordinator: this.deepLinkCoordinator,
      helpTourLauncher: this.helpTour,
      catalog: this.catalog,
      filterCoordinator: this.filter,
      personalCategory: this.personalCategory,
      memorizationPanel: this.memorizationPanel,
      lifecycleCoordinator: this.lifecycleCoordinator,
      modals: this.modals,
      refreshCoordinator: this.refresh,
      presentationNav: this.presentationNav,
    });
    this.deepLinkHost = wired.deepLinkHost;

    this.shell = createHomePageShell({
      prayerCardActions: this.prayerCardActions,
      memberCardActions: this.memberCardActions,
      modals: this.modals,
      filter: this.filter,
      personalCategory: this.personalCategory,
      memorizationPanel: this.memorizationPanel,
      helpTour: this.helpTour,
      adminNav: this.adminNav,
      presentationNav: this.presentationNav,
      memorizationRecommendationsService: this.memorizationRecommendationsService,
      planningCenterListId: () => null,
      catalog: this.catalog,
      getActiveFilter: () => this.activeFilter,
      getPersonalPrayers: () => this.personalPrayers,
    });
  }

  ngOnInit(): void {
    this.isOnline = this.connectivity.isOnline();
    this.connectivity.isOnline$
      .pipe(takeUntil(this.destroy$))
      .subscribe((online) => {
        this.isOnline = online;
        this.cdr.markForCheck();
      });
    this.subscribeDestTenantPageFields();
    this.lifecycleCoordinator.initialize(this.destroy$);
    void this.userSubscriptionService.refreshCapabilities();
    void this.loadPrayerGroups();
    this.prayerGroupService.groups$
      .pipe(takeUntil(this.destroy$))
      .subscribe((groups) => {
        this.prayerGroups = groups;
        this.canAccessGroupsTab =
          this.tenantPermissionService.canAccessGroupsTab();
        const previousSelected = this.selectedGroupId;
        if (
          this.selectedGroupId &&
          !groups.some((group) => group.id === this.selectedGroupId)
        ) {
          this.selectedGroupId = groups[0]?.id ?? null;
        } else if (!this.selectedGroupId && groups.length > 0) {
          this.selectedGroupId = groups[0].id;
        }
        if (
          this.activeFilter === "groups" &&
          this.selectedGroupId &&
          previousSelected &&
          this.selectedGroupId !== previousSelected
        ) {
          void this.loadSelectedGroupPrayers();
        }
        this.cdr.markForCheck();
      });
    this.prayerGroupService.prayers$
      .pipe(takeUntil(this.destroy$))
      .subscribe((prayers) => {
        this.groupPrayers = prayers;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.personalCategory.dispose();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeDestTenantPageFields(): void {
    const tenant = this.tenantContextService;
    tenant.memberships$
      ?.pipe(takeUntil(this.destroy$))
      .subscribe((memberships) => {
        this.tenantMemberships = memberships;
        this.cdr.markForCheck();
      });
    tenant.loading$
      ?.pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.tenantContextLoading = loading;
        this.cdr.markForCheck();
      });
    tenant.availableTenants$
      ?.pipe(takeUntil(this.destroy$))
      .subscribe((tenants) => {
        this.availableTenants = tenants;
        this.cdr.markForCheck();
      });
    tenant.isSuperAdmin$
      ?.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
    tenant.subscriberTenants$
      ?.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
  }

  getCatalogBindings() {
    return createHomeCatalogBindings({
      personalPrayers: this.personalPrayers,
      prompts: this.promptService.promptsSubject.value,
      activeFilter: this.activeFilter,
      filters: this.filters,
      personalCategoryFilterMode: this.personalCategory.personalCategoryFilterMode,
      selectedPersonalCategories: this.personalCategory.selectedPersonalCategories,
      selectedPromptTypes: this.selectedPromptTypes,
    });
  }

  refreshHomeCatalog(): void {
    syncHomeCatalog(this.catalog, this.getCatalogBindings());
  }

  getFilteredPersonalPrayers(): PrayerRequest[] {
    this.refreshHomeCatalog();
    return readHomeFilteredPersonalPrayers(this.catalog, this.getCatalogBindings());
  }

  getPrayerFormComp(): PrayerFormComponent | undefined {
    return this.modalsHost?.prayerFormComp;
  }

  getMemorizeKeyboardBridge(): HTMLInputElement | undefined {
    return this.memorizeKeyboardBridge?.nativeElement;
  }

  scrollHomePromptIntoView(promptId: string): boolean {
    return this.prayerContent?.scrollPromptIntoView(promptId) ?? false;
  }

  scrollHomePrayerIntoView(prayerId: string): boolean {
    return this.prayerContent?.scrollPrayerIntoView(prayerId) ?? false;
  }

  usesVirtualScrollMainLayout(activeFilter: HomeActiveFilter): boolean {
    return (
      activeFilter === "prompts" || isCommunityPrayerFilter(activeFilter)
    );
  }

  async loadAdminSettings(): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client
        .from("admin_settings")
        .select("deletions_allowed, updates_allowed")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        console.error("Error loading admin settings:", error);
        return;
      }

      if (data) {
        this.deletionsAllowed = data.deletions_allowed || "everyone";
        this.updatesAllowed = data.updates_allowed || "everyone";
        this.cdr.detectChanges();
      }
    } catch (err) {
      console.error("Error loading admin settings:", err);
    }
  }

  applyInitialView(session: UserSessionData): void {
    if (this.viewReady) {
      return;
    }

    if (this.route.snapshot.queryParamMap.get("filter") === "memorize") {
      this.filter.setFilter("memorize");
      this.clearMemorizeFilterQueryParam();
      this.viewReady = true;
      this.cdr.markForCheck();
      return;
    }

    this.canAccessShared = this.tenantPermissionService.canAccessShared();
    this.canAccessGroupsTab = this.tenantPermissionService.canAccessGroupsTab();
    const preferred = session.defaultPrayerView ?? "current";
    if (!this.canAccessShared && this.canAccessGroupsTab) {
      this.filter.setFilter("groups");
    } else {
      const filter =
        preferred === "current" || preferred === "personal"
          ? preferred
          : "current";
      this.filter.setFilter(filter);
    }
    this.viewReady = true;
    this.cdr.markForCheck();
  }

  private clearMemorizeFilterQueryParam(): void {
    if (this.route.snapshot.queryParamMap.get("filter") !== "memorize") {
      return;
    }
    void this.router.navigate([], {
      queryParams: { filter: null },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  async updateDefaultViewPreference(
    preference: "current" | "personal"
  ): Promise<boolean> {
    return updateHomeDefaultViewPreference(
      this.supabaseService.client,
      this.userSessionService,
      preference,
      this.tenantContextService.getActiveTenant()?.id
    );
  }

  consumeHomeReturnContext(): HomeReturnContext | null {
    const state = history.state as Record<string, unknown> | null;
    const returnContext = parseHomeReturnContextFromState(state);
    if (!returnContext) {
      return null;
    }

    history.replaceState(
      { ...state, [HOME_RETURN_CONTEXT_STATE_KEY]: undefined },
      ""
    );
    return returnContext;
  }

  applyHomeReturnContext(context: HomeReturnContext): void {
    this.setFilter(context.activeFilter);
    if (
      context.activeFilter === "prompts" &&
      context.selectedPromptTypes?.length
    ) {
      this.selectedPromptTypes = [...context.selectedPromptTypes];
    }
    if (
      context.activeFilter === "personal" &&
      context.selectedPersonalCategories?.length
    ) {
      this.personalCategory.personalCategoryFilterMode = "named";
      this.personalCategory.selectedPersonalCategories = [
        ...context.selectedPersonalCategories,
      ];
    }
    this.cdr.markForCheck();
  }

  async extractUniqueCategories(prayers: PrayerRequest[]): Promise<void> {
    await this.personalCategory.syncCategoriesFromPrayers(prayers);
    this.cdr.detectChanges();
  }

  getTenantName(membership: TenantMembership): string {
    if (Array.isArray(membership.tenants)) {
      return membership.tenants[0]?.name || membership.tenant_id;
    }
    return membership.tenants?.name || membership.tenant_id;
  }

  navigateToAdmin(): void {
    this.adminNav.navigateToAdmin();
  }

  getUserEmail(): string {
    return this.adminNav.getUserEmail();
  }

  markAsAnswered(id: string): void {
    this.prayerService.updatePrayerStatus(id, "answered");
  }

  deletePrayer(id: string): void {
    this.prayerService.deletePrayer(id);
  }

  async deletePersonalPrayer(id: string): Promise<void> {
    this.prayerCardActions.deletePersonalPrayer(id);
  }

  async addUpdate(updateData: Parameters<HomePrayerCardActionsController["addUpdate"]>[0]): Promise<void> {
    await this.prayerCardActions.addUpdate(updateData);
  }

  async addPersonalUpdate(updateData: {
    prayer_id: string;
    content: string;
    mark_as_answered?: boolean;
  }): Promise<void> {
    await this.prayerCardActions.addPersonalUpdate(updateData);
  }

  async deleteUpdate(event: { updateId: string; prayerId: string }): Promise<void> {
    await this.prayerCardActions.deleteUpdate(event);
  }

  async deletePersonalUpdate(event: {
    updateId: string;
    prayerId: string;
  }): Promise<void> {
    await this.prayerCardActions.deletePersonalUpdate(event);
  }

  async requestDeletion(requestData: Parameters<HomePrayerCardActionsController["requestDeletion"]>[0]): Promise<void> {
    await this.prayerCardActions.requestDeletion(requestData);
  }

  async requestUpdateDeletion(requestData: Parameters<HomePrayerCardActionsController["requestUpdateDeletion"]>[0]): Promise<void> {
    await this.prayerCardActions.requestUpdateDeletion(requestData);
  }

  async deletePrompt(id: string): Promise<void> {
    await this.prayerCardActions.deletePrompt(id);
  }

  togglePromptType(type: string): void {
    this.filter.togglePromptType(type);
  }

  isPromptTypeSelected(type: string): boolean {
    return this.selectedPromptTypes.includes(type);
  }

  togglePersonalCategory(category: string): void {
    this.personalCategory.togglePersonalCategory(category);
  }

  isPersonalCategorySelected(category: string): boolean {
    return this.personalCategory.isPersonalCategorySelected(category);
  }

  getPersonalCategoryCount(category: string): number {
    return this.personalPrayers.filter((p) => p.category === category).length;
  }

  getDisplayedPrompts(): PrayerPrompt[] {
    this.refreshHomeCatalog();
    return this.catalog.displayedPrompts;
  }

  getUniquePromptTypes(): string[] {
    this.refreshHomeCatalog();
    return this.catalog.uniquePromptTypes;
  }

  getPromptCountByType(type: string): number {
    return this.filter.getPromptCountByType(type);
  }

  getUnreadPromptCountByType(type: string): number {
    return this.filter.getUnreadPromptCountByType(type);
  }

  markAllCurrentAsRead(): void {
    this.badgeService.markAllAsReadByStatus("prayers", "current");
  }

  markAllAnsweredAsRead(): void {
    this.badgeService.markAllAsReadByStatus("prayers", "answered");
  }

  markAllPromptsAsRead(): void {
    this.badgeService.markAllAsRead("prompts");
  }

  openEditModal(prayer: PrayerRequest): void {
    this.modals.openEditModal(prayer);
  }

  onPersonalPrayerSaved(): void {
    this.modals.onPersonalPrayerSaved();
  }

  openEditUpdateModal(event: { update: PrayerUpdate; prayerId: string }): void {
    this.modals.openEditUpdateModal(event);
  }

  onPersonalUpdateSaved(): void {
    this.modals.onPersonalUpdateSaved();
  }

  openMemorizationPractice(item: MemorizedItem): void {
    this.memorizationPanel.openMemorizationPractice(item);
  }

  private async submitUpdate(
    updateData: Parameters<HomePrayerCardActionsController["addUpdate"]>[0]
  ): Promise<void> {
    await this.prayerCardActions.addUpdate(updateData);
  }

  private async submitDeletion(
    requestData: Parameters<HomePrayerCardActionsController["requestDeletion"]>[0]
  ): Promise<void> {
    await this.prayerCardActions.requestDeletion(requestData);
  }

  private async submitUpdateDeletion(
    requestData: Parameters<HomePrayerCardActionsController["requestUpdateDeletion"]>[0]
  ): Promise<void> {
    await this.prayerCardActions.requestUpdateDeletion(requestData);
  }

  async logout(): Promise<void> {
    await this.adminAuthService.logout();
  }

  onPersonalCategoryPickerOpenChange(prayerId: string, open: boolean): void {
    this.personalCategoryPickerPrayerId = open ? prayerId : null;
  }

  get selectedPersonalCategories(): string[] {
    return this.personalCategory.selectedPersonalCategories;
  }

  set selectedPersonalCategories(categories: string[]) {
    this.personalCategory.selectedPersonalCategories = categories;
  }

  get uniquePersonalCategories(): string[] {
    return this.personalCategory.uniquePersonalCategories;
  }

  set uniquePersonalCategories(categories: string[]) {
    this.personalCategory.setUniquePersonalCategoriesForTests(categories);
  }

  get showPrayerForm(): boolean {
    return this.modals.showPrayerForm;
  }

  get isSwappingCategories(): boolean {
    return this.personalCategory.isCategoryDropListDisabled;
  }

  set isSwappingCategories(value: boolean) {
    if (value) {
      this.personalCategory.setSwappingCategoriesForTests(
        ...this.uniquePersonalCategories
      );
    }
  }

  get practiceMemorizedItem(): MemorizedItem | null {
    return this.memorizationPanel.practiceMemorizedItem;
  }

  get editingPrayer(): PrayerRequest | null {
    return this.modals.editingPrayer;
  }

  set editingPrayer(prayer: PrayerRequest | null) {
    this.modals.editingPrayer = prayer;
  }

  get showEditPersonalPrayer(): boolean {
    return this.modals.showEditPersonalPrayer;
  }

  set showEditPersonalPrayer(value: boolean) {
    this.modals.showEditPersonalPrayer = value;
  }

  get editingUpdate(): PrayerUpdate | null {
    return this.modals.editingUpdate;
  }

  set editingUpdate(update: PrayerUpdate | null) {
    this.modals.editingUpdate = update;
  }

  get editingUpdatePrayerId(): string {
    return this.modals.editingUpdatePrayerId;
  }

  set editingUpdatePrayerId(id: string) {
    this.modals.editingUpdatePrayerId = id;
  }

  get showEditPersonalUpdate(): boolean {
    return this.modals.showEditPersonalUpdate;
  }

  set showEditPersonalUpdate(value: boolean) {
    this.modals.showEditPersonalUpdate = value;
  }

  get isCategoryDragging(): boolean {
    return this.personalCategory.isCategoryDragging;
  }

  set isCategoryDragging(value: boolean) {
    this.personalCategory.isCategoryDragging = value;
  }

  setFilter(filter: HomeActiveFilter): void {
    this.filter.setFilter(filter);
  }

  get canCreatePrayerGroups(): boolean {
    return this.tenantPermissionService.canCreatePrayerGroups();
  }

  get showGroupProUpgrade(): boolean {
    const limits = this.userSubscriptionService.getGroupLimits();
    return !limits.can_create_group && limits.individual_plan_tier === "free";
  }

  get maxMembersPerGroup(): number {
    return this.userSubscriptionService.getGroupLimits().max_members_per_group;
  }

  async onUpgradeToPro(): Promise<void> {
    if (!this.connectivity.requireOnline("Upgrade to Pro")) {
      return;
    }
    const url = await this.proCheckoutService.startProCheckout();
    if (url) {
      window.location.assign(url);
      return;
    }
    this.toastService.error("Could not start checkout. Please try again.");
  }

  get selectedGroupName(): string {
    return (
      this.prayerGroups.find((group) => group.id === this.selectedGroupId)?.name ??
      ""
    );
  }

  async loadPrayerGroups(): Promise<void> {
    await this.userSubscriptionService.refreshCapabilities();
    const groups = await this.prayerGroupService.loadMyGroups();
    this.prayerGroups = groups;
    this.canAccessGroupsTab = this.tenantPermissionService.canAccessGroupsTab();
    if (!this.selectedGroupId && groups.length > 0) {
      this.selectedGroupId = groups[0].id;
    }
    await this.prayerGroupService.hydrateGroupPrayers({
      force: false,
      focusGroupId: this.selectedGroupId,
    });
    this.cdr.markForCheck();
  }

  async loadSelectedGroupPrayers(): Promise<void> {
    if (!this.selectedGroupId && this.prayerGroups.length > 0) {
      this.selectedGroupId = this.prayerGroups[0]!.id;
    }
    await this.prayerGroupService.loadGroupPrayers(this.selectedGroupId);
  }

  openCreateGroup(): void {
    if (!this.canCreatePrayerGroups) {
      if (this.showGroupProUpgrade) {
        void this.onUpgradeToPro();
      }
      return;
    }
    this.showGroupEditor = true;
    this.cdr.markForCheck();
  }

  closeGroupEditor(): void {
    this.showGroupEditor = false;
    this.groupEditorSubmitting = false;
    this.cdr.markForCheck();
  }

  async onCreateGroup(name: string): Promise<void> {
    this.groupEditorSubmitting = true;
    this.cdr.markForCheck();
    const created = await this.prayerGroupService.createGroup(name);
    this.groupEditorSubmitting = false;
    if (created) {
      this.selectedGroupId = created.id;
      this.filter.setFilter("groups");
      await this.loadPrayerGroups();
      this.closeGroupEditor();
      this.membersGroupIdToOpen = created.id;
    }
    this.cdr.markForCheck();
  }

  async onGroupEditorChanged(): Promise<void> {
    const previousSelected = this.selectedGroupId;
    await this.loadPrayerGroups();
    const stillExists = this.prayerGroups.some(
      (group) => group.id === previousSelected
    );
    if (!stillExists) {
      this.selectedGroupId = this.prayerGroups[0]?.id ?? null;
      await this.loadSelectedGroupPrayers();
    }
    if (this.prayerGroups.length === 0) {
      this.closeGroupEditor();
    }
    this.cdr.markForCheck();
  }

  onMembersGroupOpened(): void {
    this.membersGroupIdToOpen = null;
    this.cdr.markForCheck();
  }

  get currentUserEmail(): string {
    return this.userSessionService.getUserEmail()?.toLowerCase() ?? "";
  }

  async onSelectGroup(groupId: string): Promise<void> {
    this.selectedGroupId = groupId;
    this.filter.setFilter("groups");
    await this.loadSelectedGroupPrayers();
    this.cdr.markForCheck();
  }

  onFiltersChange(filters: PrayerFilters): void {
    this.filter.onFiltersChange(filters);
  }

  async onPullToRefresh(): Promise<void> {
    await this.refresh.onPullToRefresh();
  }

  onPrayerFormClose(_event?: { isPersonal?: boolean }): void {
    this.modals.onPrayerFormClose();
  }

  openPrayerRequest(): void {
    if (!this.connectivity.requireOnline("submit a prayer")) {
      return;
    }
    this.modals.showPrayerForm = true;
    this.cdr.markForCheck();
  }

  onPresentationLinkClick(event: MouseEvent): void {
    this.presentationNav.onPresentationLinkClick(event);
  }

  get presentationHandoffQueryParams(): Record<string, string> | null {
    return this.presentationNav.presentationHandoffQueryParams;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  async onPersonalPrayerDrop(event: CdkDragDrop<PrayerRequest[]>): Promise<void> {
    await this.personalCategory.onPersonalPrayerDrop(event);
  }

  onCategoryDragStarted(): void {
    this.personalCategory.onCategoryDragStarted();
  }

  onCategoryDragEnded(): void {
    this.personalCategory.onCategoryDragEnded();
  }

  async onCategoryDrop(event: CdkDragDrop<string[]>): Promise<void> {
    await this.personalCategory.onCategoryDrop(event);
  }
}
