import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  RouterModule,
  Router,
  ActivatedRoute,
  NavigationEnd,
} from "@angular/router";
import { ChangeDetectorRef } from "@angular/core";
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from "@angular/cdk/drag-drop";
import { PrayerFormComponent } from "../../components/prayer-form/prayer-form.component";
import {
  PrayerFiltersComponent,
  PrayerFilters,
} from "../../components/prayer-filters/prayer-filters.component";
import { SkeletonLoaderComponent } from "../../components/skeleton-loader/skeleton-loader.component";
import { AppLogoComponent } from "../../components/app-logo/app-logo.component";
import { PrayerCardComponent } from "../../components/prayer-card/prayer-card.component";
import {
  PromptCardComponent,
  PrayerPrompt,
} from "../../components/prompt-card/prompt-card.component";
import { UserSettingsComponent } from "../../components/user-settings/user-settings.component";
import { VerificationDialogComponent } from "../../components/verification-dialog/verification-dialog.component";
import { HelpModalComponent } from "../../components/help-modal/help-modal.component";
import { PersonalPrayerEditModalComponent } from "../../components/personal-prayer-edit-modal/personal-prayer-edit-modal.component";
import { PersonalPrayerUpdateEditModalComponent } from "../../components/personal-prayer-update-edit-modal/personal-prayer-update-edit-modal.component";
import { ConfirmationDialogComponent } from "../../components/confirmation-dialog/confirmation-dialog.component";
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
import { Observable, take, Subject, takeUntil, filter, map, distinctUntilChanged, skip, combineLatest } from "rxjs";
import { ToastService } from "../../services/toast.service";
import { PersonalCategoryColorService } from "../../services/personal-category-color.service";
import { AnalyticsService } from "../../services/analytics.service";
import { PullToRefreshDirective } from "../../directives/pull-to-refresh.directive";
import { TenantPermissionService } from "../../services/tenant-permission.service";
import { TenantContextService } from "../../services/tenant-context.service";
import { ConnectivityService } from "../../services/connectivity.service";
import { MemorizationService } from "../../services/memorization.service";
import { MemorizationRecommendationsService } from "../../services/memorization-recommendations.service";
import { ScriptureService } from "../../services/scripture.service";
import { MemorizationActionBarComponent } from "../../components/memorization-action-bar/memorization-action-bar.component";
import { MemorizedVerseCardComponent } from "../../components/memorized-verse-card/memorized-verse-card.component";
import { MemorizationRecommendationsModalComponent } from "../../components/memorization-recommendations-modal/memorization-recommendations-modal.component";
import { AddMemorizedVerseModalComponent } from "../../components/add-memorized-verse-modal/add-memorized-verse-modal.component";
import { AddMemorizedBibleBooksModalComponent } from "../../components/add-memorized-bible-books-modal/add-memorized-bible-books-modal.component";
import {
  PROMPT_TYPE_CHIP_ACTIVE_CLASS,
  PROMPT_TYPE_CHIP_INACTIVE_CLASS,
} from "../../lib/prompt-type-chip-classes";
import { MemorizationPracticeSessionComponent } from "../../components/memorization-practice-session/memorization-practice-session.component";
import { groupItemsByMasterLevel } from "../../lib/memorization/memorization-mastery";
import { memorizationNeedsKeyboardOnOpen } from "../../lib/memorization/memorizationKeyboardPractice";
import type {
  MemorizedItem,
  MemorizationInProgressSavePayload,
  BibleTranslation,
  MemorizationRecommendation,
  MemorizationRecommendationAddPayload,
} from "../../types/memorization";
import {
  BRANDING_CACHE_KEYS,
  getBrandingCacheKey,
} from "../../utils/branding-cache-keys";
import type { Tenant, TenantMembership } from "../../types/tenant";
import {
  buildPresentationHomeHandoff,
  PRESENTATION_HOME_HANDOFF_STATE_KEY,
  HOME_RETURN_CONTEXT_STATE_KEY,
  parseHomeReturnContextFromState,
  serializePresentationHomeHandoffQueryParams,
  type HomePresentationFilter,
  type SelectablePresentationContentType,
  type HomeReturnContext,
} from "../../types/presentation";
import { mapHomeFilterToContentType } from "../../services/presentation-settings.service";

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
import {
  createHomeCatalogBindings,
  readHomeFilteredPersonalPrayers,
  syncHomeCatalog,
  wireHomeCoordinators,
  type HomeCoordinatorWiringPage,
} from "../../services/home-coordinator-wiring";
import type { HomeLifecyclePageBindings } from "../../services/home-lifecycle-host.adapter";
import { updateHomeDefaultViewPreference } from "../../lib/home-default-view-preference";
@Component({
  selector: "app-home",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    DragDropModule,
    PrayerFormComponent,
    PrayerFiltersComponent,
    SkeletonLoaderComponent,
    AppLogoComponent,
    PrayerCardComponent,
    PromptCardComponent,
    UserSettingsComponent,
    HelpModalComponent,
    PersonalPrayerEditModalComponent,
    PersonalPrayerUpdateEditModalComponent,
    ConfirmationDialogComponent,
    PullToRefreshDirective,
    MemorizationActionBarComponent,
    MemorizedVerseCardComponent,
    MemorizationRecommendationsModalComponent,
    AddMemorizedVerseModalComponent,
    AddMemorizedBibleBooksModalComponent,
    MemorizationPracticeSessionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.css",
})
export class HomeComponent implements OnInit, OnDestroy, HomeCoordinatorWiringPage, HomeLifecyclePageBindings {
  readonly promptTypeActiveClass = PROMPT_TYPE_CHIP_ACTIVE_CLASS;
  readonly promptTypeInactiveClass = PROMPT_TYPE_CHIP_INACTIVE_CLASS;

  @ViewChild("memorizeKeyboardBridge")
  private memorizeKeyboardBridge?: ElementRef<HTMLInputElement>;

  prayers$!: Observable<PrayerRequest[]>;
  prompts$!: Observable<PrayerPrompt[]>;
  loading$!: Observable<boolean>;
  error$!: Observable<string | null>;
  isAdmin$!: Observable<boolean>;

  // Current prayers array for filtering
  currentPrayers: PrayerRequest[] = [];

  // Personal prayers
  personalPrayers: PrayerRequest[] = [];
  isReorderingPersonalPrayers = false;

  // Badge observables
  currentPrayerBadge$!: Observable<number>;
  answeredPrayerBadge$!: Observable<number>;
  promptBadge$!: Observable<number>;

  currentPrayersCount = 0;
  answeredPrayersCount = 0;
  totalPrayersCount = 0;
  promptsCount = 0;
  personalPrayersCount = 0;
  memorizedItems: MemorizedItem[] = [];
  memorizedItemsCount = 0;
  memorizedLearning: MemorizedItem[] = [];
  memorizedPracticing: MemorizedItem[] = [];
  memorizedMastered: MemorizedItem[] = [];
  readonly personalCategoryActiveClass =
    'border !border-[#2F5F54] dark:!border-[#2F5F54] bg-slate-100 dark:bg-green-900/40 ring ring-[#2F5F54] dark:ring-[#2F5F54] ring-offset-0 text-gray-700 dark:text-gray-300 shadow-md';
  readonly memorizedVerseGridClass =
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';
  memorizationRecommendationOwnedKeys = new Set<string>();
  addingRecommendationId: string | null = null;
  showAddMemorizedVerse = false;
  showAddMemorizedBibleBooks = false;
  showMemorizationRecommendations = false;
  practiceMemorizedItem: MemorizedItem | null = null;
  showRemoveMemorizedConfirm = false;
  memorizedItemToRemove: MemorizedItem | null = null;
  preferredBibleTranslation: BibleTranslation = 'esv';

  showPrayerForm = false;
  isOnline = true;
  showSettings = false;
  showHelp = false;
  showLogoutConfirmation = false;
  showEditPersonalPrayer = false;
  editingPrayer: PrayerRequest | null = null;
  showEditPersonalUpdate = false;
  editingUpdate: PrayerUpdate | null = null;
  editingUpdatePrayerId = "";
  filters: PrayerFilters = { status: "current" };
  hasLogo = false;
  activeFilter:
    | "current"
    | "answered"
    | "total"
    | "prompts"
    | "personal"
    | "memorize" = "current";
  viewReady = false;
  pendingHomeReturnContext: HomeReturnContext | null = null;
  selectedPromptTypes: string[] = [];
  selectedPersonalCategories: string[] = [];
  isCategoryDragging = false;
  uniquePersonalCategories: string[] = [];
  isSwappingCategories = false;
  isRefreshing = false;
  lastExplicitRefreshAt = 0;
  canAccessShared = false;
  get canAccessAdminFeatures(): boolean {
    return this.tenantPermissionService.canAccessAdmin();
  }
  tenantMemberships: TenantMembership[] = [];
  availableTenants: Tenant[] = [];
  tenantContextLoading = true;

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


  readonly catalog = new HomeCatalogStore();
  readonly filter = new HomeFilterCoordinator();
  readonly personalCategory = new HomePersonalCategoryController();
  readonly memorizationPanel = new HomeMemorizationPanelController();
  readonly lifecycleCoordinator = new HomeLifecycleCoordinator();
  readonly modals = new HomeModalController();
  readonly refresh = new HomeRefreshCoordinator();
  readonly deepLinkCoordinator = new HomeDeepLinkCoordinator();
  readonly prayerCardActions: HomePrayerCardActionsController;
  readonly presentationNav: HomePresentationNavigationController;
  private deepLinkHost!: HomeDeepLinkHostAdapter;

  isAdmin = false;
  // Admin settings for access control policies
  // These are loaded from admin_settings and control who can delete prayers/updates
  deletionsAllowed: "everyone" | "original-requestor" | "admin-only" =
    "everyone";
  updatesAllowed: "everyone" | "original-requestor" | "admin-only" = "everyone";

  // Subject for managing subscriptions
  private destroy$ = new Subject<void>();

  constructor(
    public prayerService: PrayerService,
    public promptService: PromptService,
    public adminAuthService: AdminAuthService,
    public userSessionService: UserSessionService,
    public badgeService: BadgeService,
    private toastService: ToastService,
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private tenantPermissionService: TenantPermissionService,
    private tenantContextService: TenantContextService,
    private connectivity: ConnectivityService,
    public memorizationService: MemorizationService,
    public memorizationRecommendationsService: MemorizationRecommendationsService,
    private scriptureService: ScriptureService,
    private personalCategoryColorService: PersonalCategoryColorService
  ) {
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

    this.prayerCardActions = new HomePrayerCardActionsController(
      this.prayerService,
      this.promptService,
      this.toastService,
      this.userSessionService
    );
    const homeHandoff = new PresentationHomeHandoffCoordinator();
    this.presentationNav = new HomePresentationNavigationController(
      this.router,
      homeHandoff
    );

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
      supabaseService: this.supabaseService,
      prayerCardActions: this.prayerCardActions,
      deepLinkCoordinator: this.deepLinkCoordinator,
      helpTourLauncher: null,
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
  }

  getCatalogBindings() {
    return createHomeCatalogBindings({
      personalPrayers: this.personalPrayers,
      prompts: this.promptService.promptsSubject.value,
      activeFilter: this.activeFilter,
      filters: this.filters,
      personalCategoryFilterMode: this.personalCategory.personalCategoryFilterMode,
      selectedPersonalCategories: this.selectedPersonalCategories,
      selectedPromptTypes: this.selectedPromptTypes,
    });
  }

  refreshHomeCatalog(): void {
    syncHomeCatalog(this.catalog, this.getCatalogBindings());
  }

  getPrayerFormComp(): PrayerFormComponent | undefined {
    return undefined;
  }

  getMemorizeKeyboardBridge(): HTMLInputElement | undefined {
    return this.memorizeKeyboardBridge?.nativeElement;
  }

  ngOnInit(): void {
    this.isOnline = this.connectivity.isOnline();
    this.connectivity.isOnline$
      .pipe(takeUntil(this.destroy$))
      .subscribe((online) => {
        this.isOnline = online;
        this.cdr.markForCheck();
      });
    this.preferredBibleTranslation = this.memorizationService.getPreferredTranslation();
    this.subscribeDestTenantPageFields();
    this.lifecycleCoordinator.initialize(this.destroy$);
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

  onPrayerFormClose(event: { isPersonal?: boolean }): void {
    this.showPrayerForm = false;
    // Personal prayers are automatically updated by the service observable
    // No need for manual invalidation or reload
  }

  ngOnDestroy(): void {
    // Complete the subject to unsubscribe from all observables
    this.personalCategory.dispose();
    this.destroy$.next();
    this.destroy$.complete();
  }

  async onPullToRefresh(): Promise<void> {
    await this.refresh.onPullToRefresh();
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
        // Load deletion and update policies from admin settings
        // These control who can delete prayers/updates and who can submit updates
        this.deletionsAllowed = data.deletions_allowed || "everyone";
        this.updatesAllowed = data.updates_allowed || "everyone";
        this.cdr.detectChanges();
      }
    } catch (err) {
      console.error("Error loading admin settings:", err);
    }
  }

  onFiltersChange(filters: PrayerFilters): void {
    this.filter.onFiltersChange(filters);
  }

  setFilter(
    filter:
      | "current"
      | "answered"
      | "total"
      | "prompts"
      | "personal"
      | "memorize"
  ): void {
    this.filter.setFilter(filter);
  }

  applyInitialView(session: UserSessionData): void {
    if (this.viewReady) {
      return;
    }

    if (this.route.snapshot.queryParamMap.get("filter") === "memorize") {
      this.setFilter("memorize");
      this.clearMemorizeFilterQueryParam();
      this.viewReady = true;
      this.cdr.markForCheck();
      return;
    }

    this.canAccessShared = this.tenantPermissionService.canAccessShared();
    const preferred = session.defaultPrayerView ?? "current";
    const filter =
      preferred === "current" || preferred === "personal"
        ? preferred
        : "current";
    this.setFilter(filter);
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

  /**
   * Update the user's default prayer view preference in database
   */
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

  markAsAnswered(id: string): void {
    this.prayerService.updatePrayerStatus(id, "answered");
  }

  deletePrayer(id: string): void {
    this.prayerService.deletePrayer(id);
  }

  deletePersonalPrayer(id: string): void {
    this.prayerService.deletePersonalPrayer(id).catch((error) => {
      console.error("Error deleting personal prayer:", error);
    });
    // Service updates cache and observable automatically
  }

  async addUpdate(updateData: any): Promise<void> {
    try {
      await this.submitUpdate(updateData);
    } catch (error) {
      console.error("Error adding update:", error);
      this.toastService.error("Failed to submit update");
    }
  }

  async addPersonalUpdate(updateData: any): Promise<void> {
    try {
      const userSession = this.userSessionService.getCurrentSession();
      const author = userSession?.fullName || "Anonymous";
      const authorEmail = userSession?.email || "";

      const success = await this.prayerService.addPersonalPrayerUpdate(
        updateData.prayer_id,
        updateData.content,
        author,
        authorEmail,
        updateData.mark_as_answered || false
      );

      if (success) {
        // If update is marked as answered, set the prayer category to "Answered"
        if (updateData.mark_as_answered) {
          await this.prayerService.updatePersonalPrayer(updateData.prayer_id, {
            category: "Answered",
          });
        }
        // Service updates observable and cache automatically
      }
    } catch (error) {
      console.error("Error adding personal prayer update:", error);
      this.toastService.error("Failed to add update");
    }
  }

  async deleteUpdate(event: {
    updateId: string;
    prayerId: string;
  }): Promise<void> {
    try {
      const { updateId } = event;
      await this.prayerService.deleteUpdate(updateId);
    } catch (error) {
      console.error("Error deleting update:", error);
      this.toastService.error("Failed to delete update");
    }
  }

  async deletePersonalUpdate(event: {
    updateId: string;
    prayerId: string;
  }): Promise<void> {
    try {
      const { updateId } = event;
      const success = await this.prayerService.deletePersonalPrayerUpdate(
        updateId
      );
      if (success) {
        // Service updates cache and observable automatically
      }
    } catch (error) {
      console.error("Error deleting personal prayer update:", error);
      this.toastService.error("Failed to delete update");
    }
  }

  async onPersonalPrayerDrop(
    event: CdkDragDrop<PrayerRequest[]>
  ): Promise<void> {
    // If the index hasn't changed, no need to do anything
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    // Only allow reordering when viewing a single category
    if (this.selectedPersonalCategories.length !== 1) {
      this.toastService.error("Select a single category to reorder prayers");
      return;
    }

    try {
      this.isReorderingPersonalPrayers = true;

      // Get the filtered prayers (what the user sees)
      const filteredPrayers = this.getFilteredPersonalPrayers();

      // Get the prayer being moved
      const movedPrayer = filteredPrayers[event.previousIndex];

      // Save the original personalPrayers state for potential rollback
      const originalPersonalPrayers = [...this.personalPrayers];

      // Reorder the filtered array
      moveItemInArray(filteredPrayers, event.previousIndex, event.currentIndex);

      // Update the personalPrayers array immediately for instant visual feedback
      // Remove the moved prayer from its old position
      const oldIndex = this.personalPrayers.findIndex(
        (p) => p.id === movedPrayer.id
      );
      if (oldIndex !== -1) {
        this.personalPrayers.splice(oldIndex, 1);
      }

      // Find where to insert it based on the prayers around it in the filtered array
      const newPositionInFiltered = event.currentIndex;
      if (newPositionInFiltered === 0) {
        // Moving to first position - find the first prayer in filtered list and insert before it
        const firstPrayer = filteredPrayers[1]; // The prayer now after the moved one
        if (firstPrayer) {
          const firstIndex = this.personalPrayers.findIndex(
            (p) => p.id === firstPrayer.id
          );
          this.personalPrayers.splice(firstIndex, 0, movedPrayer);
        } else {
          // Only one prayer in category, just add it
          this.personalPrayers.push(movedPrayer);
        }
      } else {
        // Moving to middle or end - insert after the previous prayer
        const previousPrayer = filteredPrayers[newPositionInFiltered - 1];
        const previousIndex = this.personalPrayers.findIndex(
          (p) => p.id === previousPrayer.id
        );
        this.personalPrayers.splice(previousIndex + 1, 0, movedPrayer);
      }

      // Trigger immediate change detection for instant visual feedback
      this.cdr.detectChanges();

      // Persist the new order to the database (only the filtered prayers in this category)
      const success = await this.prayerService.updatePersonalPrayerOrder(
        filteredPrayers
      );

      if (success) {
        // Service updates cache and observable automatically
        this.cdr.detectChanges();
      } else {
        this.toastService.error("Failed to reorder prayers");
        // Rollback the UI to the original state
        this.personalPrayers = originalPersonalPrayers;
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error("Error reordering personal prayers:", error);
      this.toastService.error("Failed to reorder prayers");
    } finally {
      this.isReorderingPersonalPrayers = false;
    }
  }

  onCategoryDragStarted(): void {
    this.isCategoryDragging = true;
    document.body.style.cursor = "grabbing";
  }

  onCategoryDragEnded(): void {
    this.isCategoryDragging = false;
    document.body.style.cursor = "";
  }

  async onCategoryDrop(event: CdkDragDrop<string[]>): Promise<void> {
    // If the index hasn't changed, no need to do anything
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    // Prevent multiple concurrent swaps
    if (this.isSwappingCategories) {
      return;
    }

    // Make a copy of the original array to compare after
    const originalCategories = [...this.uniquePersonalCategories];

    // Immediately move item in the array for instant visual feedback
    moveItemInArray(
      this.uniquePersonalCategories,
      event.previousIndex,
      event.currentIndex
    );
    this.isSwappingCategories = true;
    this.cdr.detectChanges();

    try {
      let success = false;

      // Check if this is a simple adjacent swap (more efficient RPC method)
      const isAdjacentSwap =
        Math.abs(event.previousIndex - event.currentIndex) === 1;

      if (isAdjacentSwap) {
        // Use efficient RPC-based swap for adjacent categories (95% less egress)
        const categoryA = originalCategories[event.previousIndex];
        const categoryB = originalCategories[event.currentIndex];
        success = await this.prayerService.swapCategoryRanges(
          categoryA,
          categoryB
        );
      } else {
        // Use full reorder for non-adjacent moves (e.g., dragging from last to first)
        success = await this.prayerService.reorderCategories(
          this.uniquePersonalCategories
        );
      }

      if (success) {
        // Service updates cache and observable automatically
        // Re-extract categories from the prayers to match the new database order
        await this.extractUniqueCategories(this.personalPrayers);

        this.cdr.detectChanges();
      } else {
        this.toastService.error("Failed to reorder categories");
        // Move back to original position in UI since swap failed
        moveItemInArray(
          this.uniquePersonalCategories,
          event.currentIndex,
          event.previousIndex
        );
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error("Error reordering categories:", error);
      this.toastService.error("Failed to reorder categories");
      // Move back to original position
      moveItemInArray(
        this.uniquePersonalCategories,
        event.currentIndex,
        event.previousIndex
      );
      this.cdr.detectChanges();
    } finally {
      this.isSwappingCategories = false;
      this.cdr.detectChanges();
    }
  }

  async requestDeletion(requestData: any): Promise<void> {
    try {
      // User is logged in - submit directly without verification
      await this.submitDeletion(requestData);
    } catch (error) {
      console.error("Error requesting deletion:", error);
      this.toastService.error("Failed to submit deletion request");
    }
  }
  async requestUpdateDeletion(requestData: any): Promise<void> {
    try {
      // User is logged in - submit directly without verification
      await this.submitUpdateDeletion(requestData);
    } catch (error) {
      console.error("Error requesting update deletion:", error);
      this.toastService.error("Failed to submit update deletion request");
    }
  }

  async deletePrompt(id: string): Promise<void> {
    await this.promptService.deletePrompt(id);
  }

  togglePromptType(type: string): void {
    // If clicking the currently selected type, deselect it (show all)
    if (
      this.selectedPromptTypes.length === 1 &&
      this.selectedPromptTypes[0] === type
    ) {
      this.selectedPromptTypes = [];
    } else {
      // Select only this type (deselect all others)
      this.selectedPromptTypes = [type];
    }
  }

  isPromptTypeSelected(type: string): boolean {
    return this.selectedPromptTypes.includes(type);
  }

  togglePersonalCategory(category: string): void {
    // If clicking the currently selected category, deselect it (show all)
    if (
      this.selectedPersonalCategories.length === 1 &&
      this.selectedPersonalCategories[0] === category
    ) {
      this.selectedPersonalCategories = [];
    } else {
      // Select only this category (deselect all others)
      this.selectedPersonalCategories = [category];
    }
  }

  isPersonalCategorySelected(category: string): boolean {
    return this.selectedPersonalCategories.includes(category);
  }

  get memorizedVerseSections(): Array<{
    title: string;
    items: MemorizedItem[];
    headingClass: string;
  }> {
    const heading =
      'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2';
    const sections: Array<{
      title: string;
      items: MemorizedItem[];
      headingClass: string;
    }> = [];
    if (this.memorizedLearning.length > 0) {
      sections.push({
        title: 'Learning',
        items: this.memorizedLearning,
        headingClass: heading,
      });
    }
    if (this.memorizedPracticing.length > 0) {
      sections.push({
        title: 'Practicing',
        items: this.memorizedPracticing,
        headingClass: `${heading} mt-4`,
      });
    }
    if (this.memorizedMastered.length > 0) {
      sections.push({
        title: 'Mastered',
        items: this.memorizedMastered,
        headingClass: `${heading} mt-4`,
      });
    }
    return sections;
  }

  async extractUniqueCategories(
    prayers: PrayerRequest[]
  ): Promise<void> {
    // Use prayer service method which sorts by display_order, pass the prayers directly
    this.uniquePersonalCategories =
      await this.prayerService.getUniqueCategoriesForUser(prayers);
    // Force immediate change detection to ensure categories render
    this.cdr.detectChanges();
  }

  getPersonalCategoryCount(category: string): number {
    return this.personalPrayers.filter((p) => p.category === category).length;
  }

  getDisplayedPrompts(): PrayerPrompt[] {
    let prompts = this.promptService.promptsSubject.value;
    if (this.activeFilter !== "prompts") return [];

    // Filter by search term if present
    if (this.filters.searchTerm && this.filters.searchTerm.trim()) {
      const searchLower = this.filters.searchTerm.toLowerCase().trim();
      prompts = prompts.filter(
        (p) =>
          p.title.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower) ||
          p.type.toLowerCase().includes(searchLower)
      );
    }

    // Filter by selected types
    if (this.selectedPromptTypes.length > 0) {
      prompts = prompts.filter((p) =>
        this.selectedPromptTypes.includes(p.type)
      );
    }

    return prompts;
  }

  getUniquePromptTypes(): string[] {
    const prompts = this.promptService.promptsSubject.value;
    const seenTypes = new Set<string>();
    const orderedTypes: string[] = [];

    prompts.forEach((p) => {
      if (!seenTypes.has(p.type)) {
        seenTypes.add(p.type);
        orderedTypes.push(p.type);
      }
    });

    return orderedTypes;
  }

  getPromptCountByType(type: string): number {
    const prompts = this.promptService.promptsSubject.value;
    return prompts.filter((p) => p.type === type).length;
  }

  /**
   * Get count of unread prompts by type (prompts with badges)
   */
  getUnreadPromptCountByType(type: string): number {
    const prompts = this.promptService.promptsSubject.value;
    return prompts.filter(
      (p) => p.type === type && this.badgeService.isPromptUnread(p.id)
    ).length;
  }

  /**
   * Get personal prayers filtered by search term and category
   */
  getFilteredPersonalPrayers(): PrayerRequest[] {
    let filtered = this.personalPrayers;

    // Filter by search term if present
    if (this.filters.searchTerm && this.filters.searchTerm.trim()) {
      const searchLower = this.filters.searchTerm.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        // Search in prayer fields
        const prayerMatch =
          p.prayer_for.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower) ||
          p.title.toLowerCase().includes(searchLower);

        // Search in update content
        const updateMatch =
          p.updates &&
          p.updates.length > 0 &&
          p.updates.some(
            (update) =>
              update.content &&
              update.content.toLowerCase().includes(searchLower)
          );

        return prayerMatch || updateMatch;
      });
    }

    // Filter by selected categories
    if (this.selectedPersonalCategories.length > 0) {
      filtered = filtered.filter(
        (p) =>
          p.category && this.selectedPersonalCategories.includes(p.category)
      );
    }

    return filtered;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  private async submitUpdate(updateData: any): Promise<void> {
    await this.prayerService.addUpdate(updateData);
  }

  private async submitDeletion(requestData: any): Promise<void> {
    await this.prayerService.requestDeletion(requestData);
  }

  private async submitUpdateDeletion(requestData: any): Promise<void> {
    await this.prayerService.requestUpdateDeletion(requestData);
  }

  async logout(): Promise<void> {
    await this.adminAuthService.logout();
  }

  async handleLogout(): Promise<void> {
    this.showLogoutConfirmation = false;
    await this.logout();
  }

  openPrayerRequest(): void {
    if (!this.connectivity.requireOnline('submit a prayer')) {
      return;
    }
    this.showPrayerForm = true;
  }

  navigateToAdmin(): void {
    if (!this.connectivity.requireOnline('open the admin portal')) {
      return;
    }
    if (!this.canAccessAdminFeatures && this.tenantMemberships.length > 0) {
      this.toastService.error("Admin access is not available for this account");
      return;
    }
    this.router.navigate(["/admin"]);
  }

  getUserEmail(): string {
    // Get email from cached UserSessionService
    const cachedEmail = this.userSessionService.getUserEmail();
    if (cachedEmail) return cachedEmail;

    // Fall back to localStorage if service doesn't have it yet
    const approvalEmail = localStorage.getItem("approvalAdminEmail");
    if (approvalEmail) return approvalEmail;

    const userEmail = localStorage.getItem("userEmail");
    if (userEmail) return userEmail;

    const prayerappEmail = localStorage.getItem("prayerapp_user_email");
    if (prayerappEmail) return prayerappEmail;

    return "Not logged in";
  }

  getTenantName(membership: TenantMembership): string {
    if (Array.isArray(membership.tenants)) {
      return membership.tenants[0]?.name || membership.tenant_id;
    }
    return membership.tenants?.name || membership.tenant_id;
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

  markAllCurrentAsRead(): void {
    this.badgeService.markAllAsReadByStatus("prayers", "current");
  }

  markAllAnsweredAsRead(): void {
    this.badgeService.markAllAsReadByStatus("prayers", "answered");
  }

  markAllPromptsAsRead(): void {
    this.badgeService.markAllAsRead("prompts");
  }

  openMemorizationPractice(item: MemorizedItem): void {
    // Focus a pre-mounted bridge input *before* creating the session. iOS only opens
    // the keyboard when focus happens on an already-present field in the tap gesture;
    // a newly mounted practice input after close→reopen is too late.
    if (memorizationNeedsKeyboardOnOpen(item)) {
      this.primeMemorizeKeyboardBridge();
    }
    this.practiceMemorizedItem = item;
    // Sync CD so the practice session mounts inside the same user-gesture turn.
    this.cdr.markForCheck();
    try {
      this.cdr.detectChanges();
    } catch {
      // Test doubles / detached views may not support full CD.
    }
  }

  /** Keep the software keyboard open across close→reopen for type/initials resume. */
  private primeMemorizeKeyboardBridge(): void {
    const input = this.memorizeKeyboardBridge?.nativeElement;
    if (!input) return;
    try {
      input.focus({ preventScroll: true });
    } catch {
      try {
        input.focus();
      } catch {
        return;
      }
    }
    try {
      input.click();
    } catch {
      // ignore
    }
  }

  openMemorizationRecommendations(): void {
    this.showMemorizationRecommendations = true;
    this.cdr.markForCheck();
    void this.memorizationRecommendationsService.load(true);
  }

  isRecommendationAlreadyAdded(
    rec: MemorizationRecommendation,
    translation: BibleTranslation
  ): boolean {
    return this.memorizedItems.some(
      (item) =>
        (item.kind === "verse" || item.kind == null) &&
        item.reference === rec.reference &&
        item.translation === translation
    );
  }

  async addRecommendedVerse(payload: MemorizationRecommendationAddPayload): Promise<void> {
    const rec = payload.recommendation;
    const translation = payload.translation;
    if (this.addingRecommendationId || this.isRecommendationAlreadyAdded(rec, translation)) {
      return;
    }
    this.addingRecommendationId = rec.id;
    this.cdr.markForCheck();
    try {
      const passage = await this.scriptureService.getPassage(
        rec.reference,
        translation
      );
      const text = passage.text?.trim();
      if (!text) {
        this.toastService.error("No text returned for this passage.");
        return;
      }
      const result = await this.memorizationService.addVerse(
        rec.reference,
        translation,
        text
      );
      if (result.ok) {
        this.toastService.success("Added to memorization list.");
      } else if (result.reason === "duplicate") {
        this.toastService.error(
          "This passage is already in your memorization list."
        );
      } else if (result.reason === "no_user") {
        this.toastService.error("Sign in to add verses to memorize.");
      } else if (result.reason === "no_tenant") {
        this.toastService.error("Select an organization to memorize verses.");
      } else {
        this.toastService.error("Could not save this passage.");
      }
    } catch (e) {
      console.error(e);
      this.toastService.error("Could not save this passage.");
    } finally {
      this.addingRecommendationId = null;
      this.cdr.markForCheck();
    }
  }

  closeMemorizationPractice(): void {
    this.practiceMemorizedItem = null;
    this.cdr.markForCheck();
  }

  async onMemorizationPracticeComplete(result: {
    wrongAttempts: number;
    correctKeystrokes: number;
    completed: boolean;
  }): Promise<void> {
    const id = this.practiceMemorizedItem?.id;
    if (!id) return;
    await this.memorizationService.updatePracticeStats(id, result);
    const updated = this.memorizationService.items.find((v) => v.id === id);
    if (updated) {
      this.practiceMemorizedItem = updated;
    }
    this.cdr.markForCheck();
  }

  onMemorizationPersistInProgress(payload: MemorizationInProgressSavePayload): void {
    const id = this.practiceMemorizedItem?.id;
    if (!id) return;
    void this.memorizationService.saveInProgress(id, payload);
  }

  onMemorizationClearInProgress(): void {
    const id = this.practiceMemorizedItem?.id;
    if (!id) return;
    void this.memorizationService.clearInProgress(id);
  }

  confirmRemoveMemorizedItem(item: MemorizedItem): void {
    this.memorizedItemToRemove = item;
    this.showRemoveMemorizedConfirm = true;
    this.cdr.markForCheck();
  }

  async removeMemorizedItemConfirmed(): Promise<void> {
    const item = this.memorizedItemToRemove;
    this.showRemoveMemorizedConfirm = false;
    this.memorizedItemToRemove = null;
    if (!item) return;
    if (this.practiceMemorizedItem?.id === item.id) {
      this.practiceMemorizedItem = null;
    }
    await this.memorizationService.removeItem(item.id);
    this.cdr.markForCheck();
  }

  openEditModal(prayer: PrayerRequest): void {
    this.editingPrayer = prayer;
    this.showEditPersonalPrayer = true;
    this.cdr.markForCheck();
  }

  onPersonalPrayerSaved(): void {
    this.showEditPersonalPrayer = false;
    this.editingPrayer = null;
    this.cdr.markForCheck();
    // Personal prayers will be refreshed via service observable subscription
  }

  openEditUpdateModal(event: { update: PrayerUpdate; prayerId: string }): void {
    this.editingUpdate = event.update;
    this.editingUpdatePrayerId = event.prayerId;
    this.showEditPersonalUpdate = true;
    this.cdr.markForCheck();
  }

  onPersonalUpdateSaved(): void {
    this.showEditPersonalUpdate = false;
    this.editingUpdate = null;
    this.editingUpdatePrayerId = "";
    this.cdr.markForCheck();
    // Personal prayers will be refreshed via service observable subscription
  }

  get presentationHandoffQueryParams(): Record<string, string> | null {
    const params = serializePresentationHomeHandoffQueryParams(
      this.getPresentationHomeHandoff()
    );
    return Object.keys(params).length > 0 ? params : null;
  }

  onPresentationLinkClick(event: MouseEvent): void {
    if (this.shouldUseNativePresentationNavigation(event)) {
      return;
    }
    event.preventDefault();
    void this.router.navigate(["/presentation"], {
      state: {
        [PRESENTATION_HOME_HANDOFF_STATE_KEY]: this.getPresentationHomeHandoff(),
      },
    });
  }

  private shouldUseNativePresentationNavigation(event: MouseEvent): boolean {
    return (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    );
  }

  private getPresentationHomeHandoff() {
    const defaultPrayerView =
      this.userSessionService.getDefaultPrayerView() ?? "current";
    const contentTypes: SelectablePresentationContentType[] = [
      mapHomeFilterToContentType(
        this.activeFilter as HomePresentationFilter,
        defaultPrayerView
      ),
    ];
    return buildPresentationHomeHandoff({
      contentTypes,
      activeFilter: this.activeFilter as HomePresentationFilter,
      selectedPromptTypes: this.selectedPromptTypes,
      selectedPersonalCategories: this.selectedPersonalCategories,
    });
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

  /** True when the post-redirect URL is the app root (home). */
  private isRouterUrlHome(urlAfterRedirects: string): boolean {
    const path =
      (urlAfterRedirects.split(/[?#]/)[0] ?? "").replace(/\/+$/, "") || "/";
    return path === "/" || path === "";
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
      this.selectedPersonalCategories = [...context.selectedPersonalCategories];
    }
    this.cdr.markForCheck();
  }
}
