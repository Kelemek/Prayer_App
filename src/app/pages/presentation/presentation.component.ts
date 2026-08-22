import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ChangeDetectorRef,
  NgZone,
  ChangeDetectionStrategy,
} from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { interval, Subject, Subscription } from "rxjs";
import { distinctUntilChanged, takeUntil } from "rxjs/operators";
import { SupabaseService } from "../../services/supabase.service";
import { PrayerService } from "../../services/prayer.service";
import { PromptService } from "../../services/prompt.service";
import { UserSessionService } from "../../services/user-session.service";
import { ThemeService } from "../../services/theme.service";
import { TenantPermissionService } from "../../services/tenant-permission.service";
import { TenantContextService } from "../../services/tenant-context.service";
import { ConnectivityService } from "../../services/connectivity.service";
import { PresentationSettingsService } from "../../services/presentation-settings.service";
import { PresentationToolbarComponent } from "../../components/presentation-toolbar/presentation-toolbar.component";
import { PrayerDisplayCardComponent } from "../../components/prayer-display-card/prayer-display-card.component";
import { PresentationSettingsModalComponent } from "../../components/presentation-settings-modal/presentation-settings-modal.component";
import { markdownToPlainText } from "../../../utils/markdown";
import {
  parsePresentationHomeHandoffFromState,
  parsePresentationHomeHandoffFromQueryParams,
  HOME_RETURN_CONTEXT_STATE_KEY,
  PRESENTATION_HOME_HANDOFF_STATE_KEY,
  PRESENTATION_HOME_NAV_STATE_KEY,
  PRESENTATION_HOME_HANDOFF_QUERY_PARAM_KEYS,
  includesPresentationContentType,
  type HomeReturnContext,
  type PresentationHomeHandoff,
  type PresentationSettings,
  type PresentationTimeFilter,
  type SelectablePresentationContentType,
} from "../../types/presentation";
import type { PrayerPrompt as ServicePrayerPrompt } from "../../components/prompt-card/prompt-card.component";

interface Prayer {
  id: string;
  title: string;
  prayer_for: string;
  description: string;
  requester: string;
  status: string;
  created_at: string;
  category?: string;
  prayer_image?: string | null;
  prayed_for_count?: number;
  prayer_updates?: Array<{
    id: string;
    content: string;
    author: string;
    created_at: string;
    is_answered?: boolean;
  }>;
}

interface PrayerPrompt {
  id: string;
  title: string;
  type: string;
  description: string;
  created_at: string;
  updated_at?: string;
  prayed_for_count?: number;
}

type ThemeOption = "light" | "dark" | "system";

@Component({
  selector: "app-presentation",
  standalone: true,
  imports: [
    PresentationToolbarComponent,
    PrayerDisplayCardComponent,
    PresentationSettingsModalComponent,
  ],
  template: `
    <div
      class="w-full min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white relative"
    >
      @if (!isOnline) {
      <div
        class="absolute top-0 left-0 right-0 z-50 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
        role="status"
      >
        You're offline. Showing previously loaded content.
      </div>
      }
      <!-- Loading State -->
      @if (loading) {
      <div class="w-full min-h-screen flex items-center justify-center">
        <div class="flex flex-col items-center gap-4">
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
          ></div>
          <div class="text-gray-900 dark:text-white text-xl">
            Loading {{ getContentLoadingLabel() }}...
          </div>
        </div>
      </div>
      }

      <!-- Main Content Display -->
      @if (!loading && items.length > 0) {
      <div
        [class]="
          'h-screen flex flex-col justify-center px-3 md:px-6 py-6 transition-all duration-300 relative z-0 ' +
          (showControls ? 'presentation-content-with-toolbar' : 'pb-6')
        "
      >
        <div class="w-full max-w-6xl mx-auto h-full">
          <div class="presentation-scroll-area hide-scrollbar h-full overflow-y-auto flex items-center px-2">
            <app-prayer-display-card
              [prayer]="isPrayer(currentItem) ? currentItem : undefined"
              [prompt]="isPrompt(currentItem) ? currentItem : undefined"
            >
            </app-prayer-display-card>
          </div>
        </div>
      </div>
      }

      <!-- No Content Message -->
      @if (!loading && items.length === 0) {
      <div class="w-full min-h-screen flex items-center justify-center">
        <div class="text-center p-8">
          <div class="text-6xl mb-4">🙏</div>
          <h2
            class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2"
          >
            No Content Available
          </h2>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            {{ getEmptyContentMessage() }}
          </p>
          <button
            (click)="exitPresentation()"
            class="px-6 py-3 btn-chip btn-chip-blue"
          >
            Return to Home
          </button>
        </div>
      </div>
      }

      <!-- Toolbar -->
      <app-presentation-toolbar
        [visible]="showControls"
        [isPlaying]="isPlaying"
        [showTimer]="true"
        [countdownRemaining]="countdownRemaining"
        [currentDuration]="currentDuration"
        (previous)="previousSlide()"
        (next)="nextSlide()"
        (togglePlay)="togglePlay()"
        (settingsToggle)="showSettings = !showSettings"
        (exit)="exitPresentation()"
      >
      </app-presentation-toolbar>

      <!-- Settings Modal -->
      <app-presentation-settings-modal
        [visible]="showSettings"
        [theme]="theme"
        [smartMode]="smartMode"
        [displayDuration]="displayDuration"
        [contentTypes]="contentTypes"
        [randomize]="randomize"
        [loop]="loop"
        [timeFilter]="timeFilter"
        [statusFiltersCurrent]="statusFilters.current"
        [statusFiltersAnswered]="statusFilters.answered"
        [prayerTimerMinutes]="prayerTimerMinutes"
        [availableCategories]="uniquePersonalCategories"
        [selectedCategories]="selectedPersonalCategories"
        [availablePromptCategories]="uniquePromptCategories"
        [selectedPromptCategories]="selectedPromptCategories"
        (close)="showSettings = false"
        (themeChange)="handleThemeChange($event)"
        (smartModeChange)="smartMode = $event; persistSettings()"
        (displayDurationChange)="displayDuration = $event; persistSettings()"
        (contentTypesChange)="contentTypes = $event; handleContentTypeChange()"
        (randomizeChange)="randomize = $event; handleRandomizeChange()"
        (loopChange)="handleLoopChange($event)"
        (timeFilterChange)="timeFilter = $event; handleTimeFilterChange()"
        (statusFiltersChange)="
          statusFilters = $event; handleStatusFilterChange()
        "
        (prayerTimerMinutesChange)="prayerTimerMinutes = $event; persistSettings()"
        (categoriesChange)="handlePersonalCategoriesChange($event)"
        (promptCategoriesChange)="handlePromptCategoriesChange($event)"
        (startPrayerTimer)="startPrayerTimer()"
        (refresh)="refreshContent()"
      >
      </app-presentation-settings-modal>

      <!-- Timer Notification -->
      @if (showTimerNotification) {
      <div
        class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 safe-area-overlay"
      >
        <div
          class="bg-gradient-to-br from-green-600 to-green-700 rounded-3xl p-12 shadow-2xl border-4 border-green-400 text-center max-w-2xl mx-4 animate-pulse relative"
        >
          <button
            (click)="showTimerNotification = false"
            class="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="text-white"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="mx-auto mb-6 text-white"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
          </svg>
          <h2 class="text-6xl font-bold mb-4 text-white">
            Prayer Timer Complete! 🙏
          </h2>
          <p class="text-2xl opacity-90 text-white">
            Your prayer time has ended
          </p>
        </div>
      </div>
      }

      <!-- Presentation Complete Notification -->
      @if (showPresentationCompleteNotification) {
      <div
        class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 safe-area-overlay"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-3xl p-12 shadow-2xl border border-gray-200 dark:border-gray-700 text-center max-w-2xl mx-4 relative"
        >
          <button
            (click)="dismissPresentationComplete()"
            class="absolute top-4 right-4 p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <h2 class="text-6xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Prayers Complete! 🙏
          </h2>
          <p class="text-2xl text-gray-600 dark:text-gray-300">
            You've viewed all prayers
          </p>
        </div>
      </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      :host {
        display: block;
      }
      .presentation-content-with-toolbar {
        padding-bottom: calc(7rem + env(safe-area-inset-bottom, 0px));
      }
    `,
  ],
})
export class PresentationComponent implements OnInit, OnDestroy {
  prayers: Prayer[] = [];
  prompts: PrayerPrompt[] = [];
  personalPrayers: any[] = [];
  combinedShuffledItems: any[] = [];
  currentIndex = 0;
  isPlaying = false;
  displayDuration = 10;
  smartMode = true;
  showSettings = false;
  loading = true;
  showControls = true;
  contentTypes: SelectablePresentationContentType[] = ["prayers"];
  statusFilters = { current: true, answered: true };
  timeFilter: PresentationTimeFilter = "all";
  theme: ThemeOption = "system";
  randomize = false;
  loop = true;
  countdownRemaining = 0;
  currentDuration = 10;
  selectedPersonalCategories: string[] = [];
  uniquePersonalCategories: string[] = [];
  selectedPromptCategories: string[] = [];
  uniquePromptCategories: string[] = [];

  prayerTimerMinutes = 10;
  prayerTimerActive = false;
  prayerTimerRemaining = 0;
  showTimerNotification = false;
  showPresentationCompleteNotification = false;
  canAccessSharedContent = false;
  isOnline = true;

  private autoAdvanceInterval: any;
  private countdownSubscription: Subscription | null = null;
  private prayerTimerSubscription: Subscription | null = null;
  private initialTimerHandle: any;
  private initialPeriodElapsed = false;
  private loopOffPlaySessionActive = false;

  // Touch/swipe handling
  private touchStart: number | null = null;
  private touchEnd: number | null = null;
  private lastTap = 0;
  private readonly minSwipeDistance = 50;
  private readonly doubleTapThreshold = 300;
  private tenantChangeSub?: Subscription;
  private connectivitySub?: Subscription;
  private homeReturnContext: HomeReturnContext | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private supabase: SupabaseService,
    private prayerService: PrayerService,
    private promptService: PromptService,
    private userSessionService: UserSessionService,
    private themeService: ThemeService,
    private tenantPermissions: TenantPermissionService,
    private tenantContext: TenantContextService,
    private connectivity: ConnectivityService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private presentationSettingsService: PresentationSettingsService
  ) {}

  ngOnInit(): void {
    this.isOnline = this.connectivity.isOnline();
    this.connectivitySub = this.connectivity.isOnline$.subscribe((online) => {
      this.isOnline = online;
      this.cdr.markForCheck();
    });

    this.loadTheme();
    this.applySettings(this.presentationSettingsService.load());

    this.canAccessSharedContent = this.tenantPermissions.canAccessShared();
    if (!this.canAccessSharedContent) {
      this.contentTypes = ["personal"];
    }

    const homeHandoff = this.consumeHomeHandoff();
    if (homeHandoff) {
      this.applyHomeHandoff(homeHandoff);
    }

    this.promptService.prompts$
      .pipe(takeUntil(this.destroy$))
      .subscribe((servicePrompts) => {
        this.applyPromptPrayedForCountsFromService(servicePrompts);
      });
    this.userSessionService.userSession$
      .pipe(
        distinctUntilChanged((prev, curr) => prev?.email === curr?.email),
        takeUntil(this.destroy$)
      )
      .subscribe((session) => {
        void this.onPresentationPromptCountsSessionChange(session?.email ?? null);
      });

    this.loadContent();
    this.setupControlsAutoHide();

    this.tenantChangeSub = this.tenantContext.activeTenant$
      .pipe(distinctUntilChanged((a, b) => a?.id === b?.id))
      .subscribe(() => {
        void this.loadContent();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.connectivitySub?.unsubscribe();
    this.tenantChangeSub?.unsubscribe();
    this.clearIntervals();
    if (this.initialTimerHandle) {
      clearTimeout(this.initialTimerHandle);
    }
    if (this.prayerTimerSubscription) {
      this.prayerTimerSubscription.unsubscribe();
    }
  }

  setupControlsAutoHide(): void {
    const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (!isMobile) {
      this.initialTimerHandle = setTimeout(() => {
        this.initialPeriodElapsed = true;
        this.showControls = false;
      }, 5000);
    } else {
      this.initialPeriodElapsed = true;
    }
  }

  @HostListener("window:mousemove", ["$event"])
  handleMouseMove(event: MouseEvent): void {
    if (!this.initialPeriodElapsed) {
      return;
    }

    const windowHeight = window.innerHeight;
    const mouseY = event.clientY;

    if (mouseY > windowHeight * 0.8) {
      this.showControls = true;
    } else if (mouseY < windowHeight * 0.75) {
      this.showControls = false;
    }
  }

  @HostListener("touchstart", ["$event"])
  onTouchStart(event: TouchEvent): void {
    this.touchEnd = null;
    this.touchStart = event.touches[0].clientX;

    const now = Date.now();
    if (now - this.lastTap < this.doubleTapThreshold) {
      this.showControls = !this.showControls;
      this.lastTap = 0;
    } else {
      this.lastTap = now;
    }
  }

  @HostListener("touchmove", ["$event"])
  onTouchMove(event: TouchEvent): void {
    this.touchEnd = event.touches[0].clientX;
  }

  @HostListener("touchend")
  onTouchEnd(): void {
    if (!this.touchStart || !this.touchEnd) return;

    const distance = this.touchStart - this.touchEnd;
    const isLeftSwipe = distance > this.minSwipeDistance;
    const isRightSwipe = distance < -this.minSwipeDistance;

    if (isLeftSwipe) {
      this.nextSlide();
    } else if (isRightSwipe) {
      this.previousSlide();
    }
  }

  @HostListener("window:keydown", ["$event"])
  handleKeyboard(event: KeyboardEvent): void {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        this.previousSlide();
        break;
      case "ArrowRight":
      case " ":
        event.preventDefault();
        this.nextSlide();
        break;
      case "Escape":
        event.preventDefault();
        this.exitPresentation();
        break;
      case "p":
      case "P":
        event.preventDefault();
        this.togglePlay();
        break;
    }
  }

  loadTheme(): void {
    const savedTheme = localStorage.getItem("theme") as ThemeOption;
    if (savedTheme) {
      this.theme = savedTheme;
    }
    this.applyTheme();
  }

  applySettings(settings: PresentationSettings): void {
    this.contentTypes = [...settings.contentTypes];
    this.randomize = settings.randomize;
    this.smartMode = settings.smartMode;
    this.displayDuration = settings.displayDuration;
    this.loop = settings.loop;
    this.timeFilter = settings.timeFilter;
    this.statusFilters = { ...settings.statusFilters };
    this.prayerTimerMinutes = settings.prayerTimerMinutes;
  }

  persistSettings(): void {
    this.presentationSettingsService.save({
      contentTypes: [...this.contentTypes],
      randomize: this.randomize,
      smartMode: this.smartMode,
      displayDuration: this.displayDuration,
      loop: this.loop,
      timeFilter: this.timeFilter,
      statusFilters: { ...this.statusFilters },
      prayerTimerMinutes: this.prayerTimerMinutes,
    });
  }

  handleLoopChange(enabled: boolean): void {
    this.loop = enabled;
    this.persistSettings();
  }

  applyTheme(): void {
    const root = document.documentElement;
    let effectiveTheme: "light" | "dark";

    if (this.theme === "system") {
      const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      effectiveTheme = systemPrefersDark ? "dark" : "light";
    } else {
      effectiveTheme = this.theme;
    }

    if (effectiveTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }

  async loadContent(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();

    try {
      const fetchPromises: Promise<void>[] = [];

      if (includesPresentationContentType(this.contentTypes, "prayers")) {
        fetchPromises.push(this.fetchPrayers());
      }
      if (includesPresentationContentType(this.contentTypes, "prompts")) {
        fetchPromises.push(this.fetchPrompts());
      }
      if (includesPresentationContentType(this.contentTypes, "personal")) {
        fetchPromises.push(this.fetchPersonalPrayers());
      }

      await Promise.all(fetchPromises);

      if (this.randomize) {
        this.shuffleItems();
      }
    } catch (error) {
      console.error("Error loading content:", error);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async fetchPrayers(): Promise<void> {
    try {
      if (!this.canAccessSharedContent) {
        this.prayers = [];
        this.cdr.markForCheck();
        return;
      }

      const tenantId = this.tenantContext.getActiveTenant()?.id;
      if (!tenantId) {
        this.prayers = [];
        this.cdr.markForCheck();
        return;
      }

      let query = this.supabase.client
        .from("prayers")
        .select(
          `
          *,
          prayer_updates(
            id,
            content,
            author,
            created_at,
            approval_status
          )
        `
        )
        .eq("tenant_id", tenantId)
        .eq("approval_status", "approved");

      if (includesPresentationContentType(this.contentTypes, "prayers")) {
        const statuses: string[] = [];
        if (this.statusFilters.current) statuses.push("current");
        if (this.statusFilters.answered) statuses.push("answered");

        if (statuses.length > 0) {
          query = query.in("status", statuses);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      let prayersWithApprovedUpdates = (data || []).map((prayer) => ({
        ...prayer,
        prayer_updates: (prayer.prayer_updates || []).filter(
          (update: any) => update.approval_status === "approved"
        ),
      }));

      if (
        includesPresentationContentType(this.contentTypes, "prayers") &&
        this.timeFilter !== "all"
      ) {
        const now = new Date();
        const startDate = new Date();

        switch (this.timeFilter) {
          case "week":
            startDate.setDate(now.getDate() - 7);
            break;
          case "twoweeks":
            startDate.setDate(now.getDate() - 14);
            break;
          case "month":
            startDate.setDate(now.getDate() - 30);
            break;
          case "year":
            startDate.setDate(now.getDate() - 365);
            break;
        }

        const startTime = startDate.getTime();

        prayersWithApprovedUpdates = prayersWithApprovedUpdates.filter(
          (prayer) => {
            const prayerTime = new Date(prayer.created_at).getTime();
            if (prayerTime >= startTime) return true;

            return prayer.prayer_updates.some(
              (update: any) =>
                new Date(update.created_at).getTime() >= startTime
            );
          }
        );
      }

      const sortedPrayers = prayersWithApprovedUpdates
        .map((prayer) => ({
          prayer,
          latestActivity: Math.max(
            new Date(prayer.created_at).getTime(),
            prayer.prayer_updates && prayer.prayer_updates.length > 0
              ? Math.max(
                  ...prayer.prayer_updates.map((u: any) =>
                    new Date(u.created_at).getTime()
                  )
                )
              : 0
          ),
        }))
        .sort((a, b) => b.latestActivity - a.latestActivity)
        .map(({ prayer }) => prayer);

      this.prayers = sortedPrayers;
      this.cdr.markForCheck();
    } catch (error) {
      console.error("Error fetching prayers:", error);
      this.prayers = [];
      this.cdr.markForCheck();
    }
  }

  async fetchPrompts(): Promise<void> {
    try {
      if (!this.canAccessSharedContent) {
        this.prompts = [];
        this.cdr.markForCheck();
        return;
      }

      const tenantId = this.tenantContext.getActiveTenant()?.id;
      if (!tenantId) {
        this.prompts = [];
        this.cdr.markForCheck();
        return;
      }

      const emailAtStart =
        this.userSessionService.getUserEmail()?.trim().toLowerCase() ?? null;
      const sessionUnchanged = () =>
        (this.userSessionService.getUserEmail()?.trim().toLowerCase() ?? null) ===
        emailAtStart;

      const [typesResult, promptsResult] = await Promise.all([
        this.supabase.client
          .from("prayer_types")
          .select("name, display_order")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("display_order", { ascending: true }),

        this.supabase.client
          .from("prayer_prompts")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),
      ]);

      if (typesResult.error) throw typesResult.error;
      if (promptsResult.error) throw promptsResult.error;

      const activeTypeNames = new Set(
        (typesResult.data || []).map((t: any) => t.name)
      );
      const typeOrderMap = new Map(
        typesResult.data?.map((t: any) => [t.name, t.display_order]) || []
      );

      this.uniquePromptCategories = (typesResult.data || []).map(
        (t: any) => t.name
      );

      const sortedPrompts = (promptsResult.data || [])
        .filter((p: any) => activeTypeNames.has(p.type))
        .sort((a: any, b: any) => {
          const orderA = typeOrderMap.get(a.type) ?? 999;
          const orderB = typeOrderMap.get(b.type) ?? 999;
          return orderA - orderB;
        });

      if (!sessionUnchanged()) {
        this.prompts = sortedPrompts.map((p) => ({
          ...p,
          prayed_for_count: 0,
        }));
        this.cdr.markForCheck();
        return;
      }

      if (!emailAtStart) {
        this.prompts = sortedPrompts.map((p) => ({
          ...p,
          prayed_for_count: 0,
        }));
      } else {
        const withCounts = await this.promptService.attachPrayedForCounts(
          sortedPrompts as ServicePrayerPrompt[],
          emailAtStart
        );
        this.prompts = sessionUnchanged()
          ? withCounts
          : sortedPrompts.map((p) => ({ ...p, prayed_for_count: 0 }));
      }
      this.cdr.markForCheck();
    } catch (error) {
      console.error("Error fetching prompts:", error);
      this.prompts = [];
      this.uniquePromptCategories = [];
      this.cdr.markForCheck();
    }
  }

  private applyPromptPrayedForCountsFromService(
    servicePrompts: ServicePrayerPrompt[]
  ): void {
    if (!servicePrompts.length) {
      return;
    }
    const countById = new Map(
      servicePrompts.map((p) => [p.id, p.prayed_for_count ?? 0] as const)
    );
    this.setLocalPromptPrayedForCounts((id) =>
      countById.has(id) ? (countById.get(id) ?? 0) : null
    );
  }

  private async onPresentationPromptCountsSessionChange(
    email: string | null
  ): Promise<void> {
    if (!this.hasLocalPresentationPrompts()) {
      return;
    }

    const normalizedEmail = email?.trim().toLowerCase() ?? null;
    if (!normalizedEmail) {
      this.setLocalPromptPrayedForCounts(() => 0);
      return;
    }

    const promptSource = this.prompts.length
      ? this.prompts
      : (this.combinedShuffledItems.filter((item) =>
          this.isPrompt(item)
        ) as PrayerPrompt[]);
    if (!promptSource.length) {
      return;
    }

    const withCounts = await this.promptService.attachPrayedForCounts(
      promptSource as ServicePrayerPrompt[],
      normalizedEmail
    );
    const stillSameUser =
      this.userSessionService.getUserEmail()?.trim().toLowerCase() ===
      normalizedEmail;
    if (!stillSameUser) {
      return;
    }

    const countById = new Map(
      withCounts.map((p) => [p.id, p.prayed_for_count ?? 0] as const)
    );
    this.setLocalPromptPrayedForCounts((id) => countById.get(id) ?? 0);
  }

  private hasLocalPresentationPrompts(): boolean {
    return (
      this.prompts.length > 0 ||
      this.combinedShuffledItems.some((item) => this.isPrompt(item))
    );
  }

  private setLocalPromptPrayedForCounts(
    countForId: (id: string) => number | null
  ): void {
    let changed = false;

    if (this.prompts.length) {
      const nextPrompts = this.prompts.map((p) => {
        const count = countForId(p.id);
        if (count === null) {
          return p;
        }
        if ((p.prayed_for_count ?? 0) === count) {
          return p;
        }
        changed = true;
        return { ...p, prayed_for_count: count };
      });
      if (changed) {
        this.prompts = nextPrompts;
      }
    }

    if (this.combinedShuffledItems.length) {
      let shuffledChanged = false;
      const nextShuffled = this.combinedShuffledItems.map((item) => {
        if (!this.isPrompt(item)) {
          return item;
        }
        const count = countForId(item.id);
        if (count === null) {
          return item;
        }
        if ((item.prayed_for_count ?? 0) === count) {
          return item;
        }
        shuffledChanged = true;
        return { ...item, prayed_for_count: count };
      });
      if (shuffledChanged) {
        this.combinedShuffledItems = nextShuffled;
        changed = true;
      }
    }

    if (changed) {
      this.cdr.markForCheck();
    }
  }

  async fetchPersonalPrayers(): Promise<void> {
    try {
      const allPersonalPrayers = await new Promise<any[]>((resolve) => {
        this.prayerService.allPersonalPrayers$
          .subscribe((prayers) => {
            resolve(prayers);
          })
          .unsubscribe();
      });

      if (!allPersonalPrayers || allPersonalPrayers.length === 0) {
        this.personalPrayers = [];
        this.cdr.markForCheck();
        return;
      }

      if (this.timeFilter !== "all") {
        const now = new Date();
        const startDate = new Date();

        switch (this.timeFilter) {
          case "week":
            startDate.setDate(now.getDate() - 7);
            break;
          case "twoweeks":
            startDate.setDate(now.getDate() - 14);
            break;
          case "month":
            startDate.setMonth(now.getMonth() - 1);
            break;
          case "year":
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        }

        this.personalPrayers = allPersonalPrayers.filter((prayer: any) => {
          const prayerDate = new Date(prayer.created_at);
          if (prayerDate >= startDate && prayerDate <= now) return true;
          if (prayer.updates && Array.isArray(prayer.updates)) {
            return prayer.updates.some((update: any) => {
              const updateDate = new Date(update.created_at);
              return updateDate >= startDate && updateDate <= now;
            });
          }
          return false;
        });
      } else {
        this.personalPrayers = allPersonalPrayers;
      }

      const showCurrent = this.statusFilters.current;
      const showAnswered = this.statusFilters.answered;

      if (showCurrent || showAnswered) {
        this.personalPrayers = this.personalPrayers.filter((p: any) => {
          const isAnswered = p.category === "Answered";
          return (showCurrent && !isAnswered) || (showAnswered && isAnswered);
        });
      }

      this.extractUniquePersonalCategories();
      this.cdr.markForCheck();
    } catch (error) {
      console.error("Error fetching personal prayers:", error);
      this.personalPrayers = [];
      this.cdr.markForCheck();
    }
  }

  get items(): any[] {
    if (this.contentTypes.length === 1) {
      const only = this.contentTypes[0];
      if (only === "prayers") return this.prayers;
      if (only === "prompts") return this.getFilteredPrompts();
      if (only === "personal") {
        if (this.selectedPersonalCategories.length > 0) {
          return this.personalPrayers.filter(
            (p) =>
              p.category &&
              this.selectedPersonalCategories.includes(p.category)
          );
        }
        return this.personalPrayers;
      }
    }

    if (this.randomize && this.combinedShuffledItems.length > 0) {
      return this.combinedShuffledItems;
    }

    const combined: any[] = [];
    if (includesPresentationContentType(this.contentTypes, "prayers")) {
      combined.push(...this.prayers);
    }
    if (includesPresentationContentType(this.contentTypes, "prompts")) {
      combined.push(...this.getFilteredPrompts());
    }
    if (includesPresentationContentType(this.contentTypes, "personal")) {
      combined.push(...this.getFilteredPersonalPrayers());
    }
    return combined;
  }

  private getFilteredPersonalPrayers(): any[] {
    if (this.selectedPersonalCategories.length > 0) {
      return this.personalPrayers.filter(
        (p) =>
          p.category && this.selectedPersonalCategories.includes(p.category)
      );
    }
    return this.personalPrayers;
  }

  private getFilteredPrompts(): PrayerPrompt[] {
    if (this.selectedPromptCategories.length > 0) {
      return this.prompts.filter((p) =>
        this.selectedPromptCategories.includes(p.type)
      );
    }
    return this.prompts;
  }

  togglePersonalCategory(category: string): void {
    const index = this.selectedPersonalCategories.indexOf(category);
    if (index > -1) {
      this.selectedPersonalCategories.splice(index, 1);
    } else {
      this.selectedPersonalCategories.push(category);
    }
    this.currentIndex = 0;
  }

  isPersonalCategorySelected(category: string): boolean {
    return this.selectedPersonalCategories.includes(category);
  }

  private extractUniquePersonalCategories(): void {
    const categories = new Set<string>();
    this.personalPrayers.forEach((prayer) => {
      if (prayer.category && prayer.category.trim()) {
        categories.add(prayer.category.trim());
      }
    });
    this.uniquePersonalCategories = Array.from(categories).sort();
  }

  get currentItem(): any {
    return this.items[this.currentIndex];
  }

  isPrayer(item: any): item is Prayer {
    return item && "prayer_for" in item;
  }

  isPrompt(item: any): item is PrayerPrompt {
    return item && "type" in item && !("prayer_for" in item);
  }

  togglePlay(): void {
    if (this.showPresentationCompleteNotification) {
      this.dismissPresentationComplete(true);
      return;
    }

    this.isPlaying = !this.isPlaying;

    if (this.isPlaying) {
      if (this.items.length === 0) {
        this.isPlaying = false;
        return;
      }
      if (!this.loop && !this.loopOffPlaySessionActive) {
        this.currentIndex = 0;
        this.loopOffPlaySessionActive = true;
      }
      this.startAutoAdvance();
    } else {
      this.clearIntervals();
    }
  }

  startAutoAdvance(): void {
    if (this.items.length === 0) {
      return;
    }

    this.clearIntervals();

    const duration = this.calculateCurrentDuration();
    this.currentDuration = duration;
    this.countdownRemaining = duration;

    this.autoAdvanceInterval = setTimeout(() => {
      const advanced = this.tryAdvanceSlide();
      if (!advanced && !this.loop && this.items.length > 0) {
        this.completePresentationCycle();
        return;
      }
      if (this.isPlaying) {
        this.startAutoAdvance();
      }
    }, duration * 1000);

    this.countdownSubscription = interval(1000).subscribe(() => {
      this.ngZone.run(() => {
        if (this.countdownRemaining > 0) {
          this.countdownRemaining--;
          this.cdr.detectChanges();
        }
      });
    });
  }

  calculateCurrentDuration(): number {
    if (!this.smartMode) return this.displayDuration;

    const item = this.currentItem;
    if (!item) return this.displayDuration;

    if (this.isPrayer(item)) {
      let totalChars = markdownToPlainText(item.description).length;

      if (item.prayer_updates && item.prayer_updates.length > 0) {
        const recentUpdates = item.prayer_updates
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, 3);

        recentUpdates.forEach((update) => {
          totalChars += markdownToPlainText(update.content).length;
        });
      }

      return Math.max(10, Math.min(120, Math.ceil(totalChars / 12)));
    } else {
      const totalChars = markdownToPlainText(item.description).length;
      return Math.max(10, Math.min(120, Math.ceil(totalChars / 12)));
    }
  }

  clearIntervals(): void {
    if (this.autoAdvanceInterval) {
      clearTimeout(this.autoAdvanceInterval);
      this.autoAdvanceInterval = null;
    }
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
      this.countdownSubscription = null;
    }
  }

  private tryAdvanceSlide(): boolean {
    if (this.items.length === 0) return false;

    if (this.loop) {
      this.currentIndex = (this.currentIndex + 1) % this.items.length;
      this.cdr.markForCheck();
      return true;
    }

    if (this.currentIndex < this.items.length - 1) {
      this.currentIndex++;
      this.cdr.markForCheck();
      return true;
    }

    return false;
  }

  completePresentationCycle(): void {
    if (this.items.length === 0) {
      return;
    }

    this.isPlaying = false;
    this.loopOffPlaySessionActive = false;
    this.clearIntervals();
    this.showPresentationCompleteNotification = true;
    this.cdr.markForCheck();
  }

  dismissPresentationComplete(startPlayback = false): void {
    this.showPresentationCompleteNotification = false;
    this.showSettings = false;
    this.showTimerNotification = false;
    if (this.items.length === 0) {
      this.loopOffPlaySessionActive = false;
      this.isPlaying = false;
      this.cdr.markForCheck();
      return;
    }

    this.currentIndex = 0;
    this.loopOffPlaySessionActive = true;
    this.clearIntervals();

    if (startPlayback) {
      this.isPlaying = true;
      this.startAutoAdvance();
    } else {
      this.isPlaying = false;
    }
    this.cdr.markForCheck();
  }

  nextSlide(): void {
    if (this.showPresentationCompleteNotification || this.items.length === 0) {
      return;
    }

    const advanced = this.tryAdvanceSlide();
    if (!advanced && !this.loop && this.items.length > 0) {
      this.completePresentationCycle();
      return;
    }

    if (this.isPlaying && advanced) {
      this.startAutoAdvance();
    }
  }

  previousSlide(): void {
    if (this.showPresentationCompleteNotification || this.items.length === 0) {
      return;
    }

    if (!this.loop && this.currentIndex === 0) {
      return;
    }

    this.currentIndex = this.loop
      ? this.currentIndex === 0
        ? this.items.length - 1
        : this.currentIndex - 1
      : this.currentIndex - 1;
    this.cdr.markForCheck();

    if (this.isPlaying) {
      this.startAutoAdvance();
    }
  }

  async refreshContent(): Promise<void> {
    await this.loadContent();
    this.currentIndex = 0;
    this.cdr.markForCheck();
  }

  async handleContentTypeChange(): Promise<void> {
    this.currentIndex = 0;
    this.persistSettings();
    await this.loadContent();
    this.cdr.markForCheck();
  }

  async handleStatusFilterChange(): Promise<void> {
    this.currentIndex = 0;
    this.persistSettings();
    if (includesPresentationContentType(this.contentTypes, "prayers")) {
      await this.fetchPrayers();
    }
    if (includesPresentationContentType(this.contentTypes, "personal")) {
      await this.fetchPersonalPrayers();
    }
    this.cdr.markForCheck();
  }

  async handleTimeFilterChange(): Promise<void> {
    this.currentIndex = 0;
    this.persistSettings();
    if (includesPresentationContentType(this.contentTypes, "prayers")) {
      await this.fetchPrayers();
    }
    if (includesPresentationContentType(this.contentTypes, "personal")) {
      await this.fetchPersonalPrayers();
    }
    this.cdr.markForCheck();
  }

  async handleRandomizeChange(): Promise<void> {
    this.persistSettings();
    if (this.randomize) {
      this.shuffleItems();
    } else {
      await this.loadContent();
    }
    this.currentIndex = 0;
    this.cdr.markForCheck();
  }

  shuffleItems(): void {
    if (this.contentTypes.length === 1) {
      const only = this.contentTypes[0];
      if (only === "prayers") {
        this.prayers = this.shuffleArray([...this.prayers]);
      } else if (only === "prompts") {
        this.prompts = this.shuffleArray([...this.prompts]);
      } else if (only === "personal") {
        this.personalPrayers = this.shuffleArray([...this.personalPrayers]);
      }
      return;
    }

    const combined: any[] = [];
    if (includesPresentationContentType(this.contentTypes, "prayers")) {
      combined.push(...this.prayers);
    }
    if (includesPresentationContentType(this.contentTypes, "prompts")) {
      combined.push(...this.getFilteredPrompts());
    }
    if (includesPresentationContentType(this.contentTypes, "personal")) {
      combined.push(...this.getFilteredPersonalPrayers());
    }
    this.combinedShuffledItems = this.shuffleArray(combined);
  }

  shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  handleThemeChange(newTheme: ThemeOption): void {
    this.theme = newTheme;
    localStorage.setItem("theme", newTheme);
    this.applyTheme();
  }

  startPrayerTimer(): void {
    if (this.prayerTimerSubscription) {
      this.prayerTimerSubscription.unsubscribe();
    }

    this.showSettings = false;

    this.prayerTimerActive = true;
    this.prayerTimerRemaining = this.prayerTimerMinutes * 60;

    this.prayerTimerSubscription = interval(1000).subscribe(() => {
      this.ngZone.run(() => {
        this.prayerTimerRemaining--;
        this.cdr.detectChanges();

        if (this.prayerTimerRemaining <= 0) {
          this.prayerTimerSubscription?.unsubscribe();
          this.prayerTimerSubscription = null;
          this.prayerTimerActive = false;
          this.showTimerNotification = true;
          this.cdr.detectChanges();
        }
      });
    });
  }

  private applyHomeHandoff(handoff: PresentationHomeHandoff): void {
    this.contentTypes = [...handoff.contentTypes];

    if (handoff.statusFilters) {
      this.statusFilters = { ...handoff.statusFilters };
    }

    if (handoff.promptCategories) {
      this.selectedPromptCategories = [...handoff.promptCategories];
    }

    if (handoff.personalCategories) {
      this.selectedPersonalCategories = [...handoff.personalCategories];
    }

    if (handoff.returnContext) {
      this.homeReturnContext = {
        activeFilter: handoff.returnContext.activeFilter,
        ...(handoff.returnContext.selectedPromptTypes
          ? {
              selectedPromptTypes: [
                ...handoff.returnContext.selectedPromptTypes,
              ],
            }
          : {}),
        ...(handoff.returnContext.selectedPersonalCategories
          ? {
              selectedPersonalCategories: [
                ...handoff.returnContext.selectedPersonalCategories,
              ],
            }
          : {}),
      };
    }
  }

  private consumeHomeHandoff(): PresentationHomeHandoff | null {
    const state = history.state as Record<string, unknown> | null;
    const fromState = parsePresentationHomeHandoffFromState(state);
    if (fromState) {
      history.replaceState(
        {
          ...state,
          [PRESENTATION_HOME_HANDOFF_STATE_KEY]: undefined,
          [PRESENTATION_HOME_NAV_STATE_KEY]: undefined,
        },
        ""
      );
      return fromState;
    }

    const fromQuery = parsePresentationHomeHandoffFromQueryParams((key) =>
      this.route.snapshot.queryParamMap.get(key)
    );
    if (fromQuery) {
      const clearedParams = Object.fromEntries(
        PRESENTATION_HOME_HANDOFF_QUERY_PARAM_KEYS.map((key) => [key, null])
      );
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: clearedParams,
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
      return fromQuery;
    }

    return null;
  }

  handlePersonalCategoriesChange(categories: string[]): void {
    this.selectedPersonalCategories = categories;
    this.currentIndex = 0;
    this.cdr.markForCheck();
  }

  handlePromptCategoriesChange(categories: string[]): void {
    this.selectedPromptCategories = categories;
    this.currentIndex = 0;
    this.cdr.markForCheck();
  }

  getContentLoadingLabel(): string {
    if (this.contentTypes.length === 0) {
      return "all content";
    }
    if (this.contentTypes.length === 1) {
      switch (this.contentTypes[0]) {
        case "prayers":
          return "prayers";
        case "prompts":
          return "prompts";
        case "personal":
          return "personal prayers";
        default: {
          const _exhaustive: never = this.contentTypes[0];
          return _exhaustive;
        }
      }
    }
    return "content";
  }

  getEmptyContentMessage(): string {
    if (this.contentTypes.length === 0) {
      return "No content available";
    }
    if (this.contentTypes.length === 1) {
      switch (this.contentTypes[0]) {
        case "prayers":
          return "No prayers match your current filters";
        case "prompts":
          return "No prayer prompts available";
        case "personal":
          return "No personal prayers available";
        default: {
          const _exhaustive: never = this.contentTypes[0];
          return _exhaustive;
        }
      }
    }
    return "No content matches your current filters";
  }

  exitPresentation(): void {
    if (this.homeReturnContext) {
      void this.router.navigate(["/"], {
        state: {
          [HOME_RETURN_CONTEXT_STATE_KEY]: this.homeReturnContext,
        },
      });
      return;
    }
    void this.router.navigate(["/"]);
  }
}
