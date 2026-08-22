import { Injectable } from "@angular/core";
import { NavigationEnd, Router, ActivatedRoute } from "@angular/router";
import {
  Observable,
  Subject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  of,
  skip,
  take,
  takeUntil,
} from "rxjs";
import type { PrayerPrompt } from "../components/prompt-card/prompt-card.component";
import type { PrayerRequest } from "./prayer.service";
import type { PrayerService } from "./prayer.service";
import type { PromptService } from "./prompt.service";
import type { AdminAuthService } from "./admin-auth.service";
import type { UserSessionService } from "./user-session.service";
import type { BadgeService } from "./badge.service";
import type { AnalyticsService } from "./analytics.service";
import type { PersonalCategoryColorService } from "./personal-category-color.service";
import type { MemorizationService } from "./memorization.service";
import type { MemorizationRecommendationsService } from "./memorization-recommendations.service";
import type { HomeDeepLinkCoordinator } from "./home-deep-link.coordinator";
import type { HomeHelpTourLauncher } from "./home-help-tour.launcher";
import type { TenantContextService } from "./tenant-context.service";
import type { TenantPermissionService } from "./tenant-permission.service";
import type { ConnectivityService } from "./connectivity.service";
import type { HomeReturnContext } from "../types/presentation";
import type { HomeActiveFilter } from "./home-deep-link-host.adapter";
import type { MemorizedItem } from "../types/memorization";
import type { UserSessionData } from "./user-session.service";

export interface HomeObservableStreams {
  prayers$: Observable<PrayerRequest[]>;
  prompts$: Observable<PrayerPrompt[]>;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  isAdmin$: Observable<boolean>;
  hasAdminEmail$: Observable<boolean>;
  currentPrayerBadge$: Observable<number>;
  answeredPrayerBadge$: Observable<number>;
  promptBadge$: Observable<number>;
}

export interface HomeLifecycleHost {
  assignObservableStreams(streams: HomeObservableStreams): void;
  getPendingHomeReturnContext(): HomeReturnContext | null;
  setPendingHomeReturnContext(context: HomeReturnContext | null): void;
  getViewReady(): boolean;
  setViewReady(ready: boolean): void;
  getActiveFilter(): HomeActiveFilter;
  setActiveFilter(filter: HomeActiveFilter): void;
  setCurrentPrayers(prayers: PrayerRequest[]): void;
  setPrayerCounts(counts: {
    current: number;
    answered: number;
    archived: number;
    total: number;
  }): void;
  setPromptsCount(count: number): void;
  setPersonalPrayers(prayers: PrayerRequest[]): void;
  setPersonalPrayersCount(count: number): void;
  setIsAdmin(isAdmin: boolean): void;
  consumeHomeReturnContext(): HomeReturnContext | null;
  applyHomeReturnContext(context: HomeReturnContext): void;
  refreshHomeCatalog(): void;
  setFilter(filter: HomeActiveFilter): void;
  stripFilterQueryParam(): void;
  markForCheck(): void;
  detectChanges(): void;
  syncPersonalCategoriesFromPrayers(
    prayers: PrayerRequest[]
  ): Promise<void>;
  syncMemorizedItems(items: MemorizedItem[]): void;
  syncRecommendationGroups(): void;
  loadAdminSettings(): void;
  applyInitialView(session: UserSessionData): void;
}

export interface HomeLifecycleServices {
  router: Router;
  route?: ActivatedRoute;
  analyticsService: AnalyticsService;
  deepLinkCoordinator: HomeDeepLinkCoordinator;
  helpTourLauncher: HomeHelpTourLauncher | null;
  prayerService: PrayerService;
  promptService: PromptService;
  adminAuthService: AdminAuthService;
  userSessionService: UserSessionService;
  badgeService: BadgeService;
  personalCategoryColorService: PersonalCategoryColorService;
  memorizationService: MemorizationService;
  memorizationRecommendationsService: MemorizationRecommendationsService;
    tenantContextService?: TenantContextService;
    tenantPermissionService: TenantPermissionService;
    connectivity?: ConnectivityService;
}

export function isRouterUrlHome(urlAfterRedirects: string): boolean {
  const path =
    (urlAfterRedirects.split(/[?#]/)[0] ?? "").replace(/\/+$/, "") || "/";
  return path === "/" || path === "";
}

@Injectable()
export class HomeLifecycleCoordinator {
  private host: HomeLifecycleHost | null = null;
  private services: HomeLifecycleServices | null = null;

  bindHost(host: HomeLifecycleHost, services: HomeLifecycleServices): void {
    this.host = host;
    this.services = services;
  }

  initialize(destroy$: Subject<void>): void {
    const host = this.requireHost();
    const services = this.requireServices();

    host.setPendingHomeReturnContext(host.consumeHomeReturnContext());

    if (typeof services.router.parseUrl === "function") {
      const initialTree = services.router.parseUrl(services.router.url ?? "");
      services.deepLinkCoordinator.captureInitialQueryParams({
        filter: initialTree.queryParams["filter"],
        prayerId: initialTree.queryParams["prayerId"],
        promptId: initialTree.queryParams["promptId"],
      });
    }

    services.analyticsService.trackPageView();

    services.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(destroy$)
      )
      .subscribe((e) => {
        if (!isRouterUrlHome(e.urlAfterRedirects)) {
          return;
        }
        const tree =
          typeof services.router.parseUrl === "function"
            ? services.router.parseUrl(e.urlAfterRedirects)
            : null;
        const returnContext = host.consumeHomeReturnContext();
        if (returnContext) {
          if (host.getViewReady()) {
            host.applyHomeReturnContext(returnContext);
            host.markForCheck();
          } else {
            host.setPendingHomeReturnContext(returnContext);
          }
        }
        if (tree) {
          services.deepLinkCoordinator.handleNavigationDeepLinks(
            {
              filter: tree.queryParams["filter"],
              prayerId: tree.queryParams["prayerId"],
              promptId: tree.queryParams["promptId"],
            },
            host.getViewReady()
          );
        }
        window.setTimeout(
          () => services.helpTourLauncher?.tryResumeQueue(),
          400
        );
      });

    services.route?.queryParams.pipe(takeUntil(destroy$)).subscribe((params) => {
      if (!host.getViewReady()) {
        return;
      }
      if (params["filter"] === "memorize") {
        host.setFilter("memorize");
        host.stripFilterQueryParam();
        host.markForCheck();
      }
    });

    window.setTimeout(() => services.helpTourLauncher?.tryResumeQueue(), 200);

    const prayers$ = services.prayerService.prayers$;
    const prompts$ = services.promptService.prompts$;

    host.assignObservableStreams({
      prayers$,
      prompts$,
      loading$: services.prayerService.loading$,
      error$: services.prayerService.error$,
      isAdmin$: services.adminAuthService.isAdmin$,
      hasAdminEmail$: services.adminAuthService.hasAdminEmail$,
      currentPrayerBadge$: services.badgeService.getBadgeCount$(
        "prayers",
        "current"
      ),
      answeredPrayerBadge$: services.badgeService.getBadgeCount$(
        "prayers",
        "answered"
      ),
      promptBadge$: services.badgeService.getBadgeCount$("prompts"),
    });

    services.promptService.loadPrompts();
    services.badgeService.refreshBadgeCounts();
    host.markForCheck();

    this.subscribeTenantContext(destroy$);
    if (services.connectivity) {
      this.subscribeConnectivity(destroy$);
    }

    services.userSessionService.userSession$
      .pipe(
        distinctUntilChanged((prev, curr) => {
          if (!prev?.email || !curr?.email) {
            return prev?.email === curr?.email;
          }
          return prev.email === curr.email;
        }),
        filter(
          (
            session
          ): session is NonNullable<typeof session> & { email: string } =>
            !!session?.email
        ),
        takeUntil(destroy$)
      )
      .subscribe(() => {
        void services.personalCategoryColorService.loadColors();
      });

    prayers$.pipe(takeUntil(destroy$)).subscribe((prayers) => {
      host.setCurrentPrayers(prayers);
      host.markForCheck();
    });

    host.loadAdminSettings();

    services.prayerService.allPrayers$
      .pipe(takeUntil(destroy$))
      .subscribe((prayers) => {
        host.setPrayerCounts({
          current: prayers.filter((p) => p.status === "current").length,
          answered: prayers.filter((p) => p.status === "answered").length,
          archived: prayers.filter((p) => p.status === "archived").length,
          total: prayers.length,
        });
        services.badgeService.refreshBadgeCounts();
        host.markForCheck();
        services.deepLinkCoordinator.retryPendingPrayerDeepLinkIfNeeded();
      });

    prompts$.pipe(takeUntil(destroy$)).subscribe((prompts) => {
      host.setPromptsCount(prompts.length);
      host.refreshHomeCatalog();
      host.markForCheck();
      services.badgeService.refreshBadgeCounts();
      host.markForCheck();
      services.deepLinkCoordinator.retryPendingPromptDeepLinkIfNeeded();
    });

    services.adminAuthService.isAdmin$
      .pipe(takeUntil(destroy$))
      .subscribe((isAdmin) => {
        host.setIsAdmin(isAdmin);
      });

    services.prayerService.allPersonalPrayers$
      .pipe(takeUntil(destroy$))
      .subscribe(async (prayers) => {
        host.setPersonalPrayers(prayers);
        host.setPersonalPrayersCount(prayers.length);
        await host.syncPersonalCategoriesFromPrayers(prayers);
        host.refreshHomeCatalog();
        host.markForCheck();
        services.deepLinkCoordinator.retryPendingPrayerDeepLinkIfNeeded();
      });

    services.memorizationService.memorizedItems$
      .pipe(takeUntil(destroy$))
      .subscribe((items) => {
        host.syncMemorizedItems(items);
      });

    services.memorizationRecommendationsService.items$
      .pipe(takeUntil(destroy$))
      .subscribe(() => {
        host.syncRecommendationGroups();
      });

    const sessionLoading$ = services.userSessionService.isLoading$
      ? services.userSessionService.isLoading$.pipe(
          filter((loading) => !loading),
          take(1)
        )
      : of(false);
    const tenantLoading$ = services.tenantContextService?.loading$
      ? services.tenantContextService.loading$.pipe(
          filter((loading) => !loading),
          take(1)
        )
      : of(false);

    combineLatest([
      services.userSessionService.userSession$.pipe(
        filter((session): session is UserSessionData => !!session)
      ),
      sessionLoading$,
      tenantLoading$,
    ])
      .pipe(take(1), takeUntil(destroy$))
      .subscribe(([session]) => {
        const pendingReturn = host.getPendingHomeReturnContext();
        if (pendingReturn) {
          host.applyHomeReturnContext(pendingReturn);
          host.setPendingHomeReturnContext(null);
          host.setViewReady(true);
          host.markForCheck();
        } else {
          host.applyInitialView(session);
        }
        services.deepLinkCoordinator.applyPendingDeepLinksOnViewReady();
      });
  }

  private subscribeTenantContext(destroy$: Subject<void>): void {
    const host = this.requireHost();
    const services = this.requireServices();
    const tenant = services.tenantContextService;
    if (!tenant) {
      return;
    }

    tenant.activeTenant$
      ?.pipe(
        map((active) => active?.id ?? null),
        distinctUntilChanged(),
        skip(1),
        takeUntil(destroy$)
      )
      .subscribe(async () => {
        const canAccessShared = services.tenantPermissionService.canAccessShared();
        const activeFilter = host.getActiveFilter();
        if (
          !canAccessShared &&
          activeFilter !== "personal" &&
          activeFilter !== "memorize"
        ) {
          host.setFilter("personal");
        } else {
          await Promise.all([
            services.prayerService.loadPrayers(),
            services.promptService.loadPrompts(),
            services.prayerService.loadPersonalPrayers(false),
            services.memorizationService.loadItems(),
          ]);
        }
        host.markForCheck();
      });

    tenant.memberships$?.pipe(takeUntil(destroy$)).subscribe(() => {
      host.markForCheck();
    });

    tenant.loading$?.pipe(takeUntil(destroy$)).subscribe(() => {
      host.markForCheck();
    });

    tenant.isSuperAdmin$?.pipe(takeUntil(destroy$)).subscribe(() => {
      host.markForCheck();
    });

    tenant.availableTenants$?.pipe(takeUntil(destroy$)).subscribe(() => {
      host.markForCheck();
    });

    tenant.subscriberTenants$?.pipe(takeUntil(destroy$)).subscribe(() => {
      host.markForCheck();
    });
  }

  private subscribeConnectivity(destroy$: Subject<void>): void {
    const host = this.requireHost();
    const services = this.requireServices();
    services.connectivity?.isOnline$
      .pipe(takeUntil(destroy$))
      .subscribe(() => host.markForCheck());
  }

  private requireHost(): HomeLifecycleHost {
    if (!this.host) {
      throw new Error("HomeLifecycleCoordinator host is not bound");
    }
    return this.host;
  }

  private requireServices(): HomeLifecycleServices {
    if (!this.services) {
      throw new Error("HomeLifecycleCoordinator services are not bound");
    }
    return this.services;
  }
}
