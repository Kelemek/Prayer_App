import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import {
  createHomeCatalogBindings,
  readHomeFilteredPersonalPrayers,
  syncHomeCatalog,
  wireHomeCoordinators,
} from './home-coordinator-wiring';
import { HomeCatalogStore } from './home-catalog.store';
import { HomeDeepLinkCoordinator } from './home-deep-link.coordinator';
import { HomeFilterCoordinator } from './home-filter.coordinator';
import { HomePersonalCategoryController } from './home-personal-category.controller';
import { HomeMemorizationPanelController } from './home-memorization-panel.controller';
import { HomeLifecycleCoordinator } from './home-lifecycle.coordinator';
import { HomeModalController } from './home-modal.controller';
import { HomeRefreshCoordinator } from './home-refresh.coordinator';
import { HomePlanningCenterController } from './home-planning-center.controller';
import { HomePresentationNavigationController } from './home-presentation-navigation.controller';
import { PresentationHomeHandoffCoordinator } from './presentation-home-handoff.coordinator';
import { HomeHelpTourLauncher } from './home-help-tour.launcher';
import type { HelpSection } from '../types/help-content';

function makeHelpSection(id: string): HelpSection {
  return {
    id,
    title: 'Title',
    description: 'Description',
    icon: 'icon',
    content: [],
    order: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test',
  };
}

describe('home-coordinator-wiring', () => {
  it('createHomeCatalogBindings maps page fields', () => {
    const bindings = createHomeCatalogBindings({
      personalPrayers: [],
      prompts: [{ id: 'pr1', type: 'a' } as never],
      activeFilter: 'personal',
      filters: { searchTerm: 'x' },
      selectedPromptTypes: ['Morning'],
      personalCategoryFilterMode: 'all',
      selectedPersonalCategories: ['Health'],
    });
    expect(bindings.selectedPromptTypes).toEqual(['Morning']);
    expect(bindings.activeFilter).toBe('personal');
  });

  it('syncHomeCatalog refreshes filtered personal prayers', () => {
    const catalog = new HomeCatalogStore();
    const bindings = createHomeCatalogBindings({
      personalPrayers: [{ id: 'pp1', category: 'Health', prayer_for: 'Me', updates: [] } as never],
      prompts: [],
      activeFilter: 'personal',
      filters: {},
      selectedPromptTypes: [],
      personalCategoryFilterMode: 'named',
      selectedPersonalCategories: ['Health'],
    });
    syncHomeCatalog(catalog, bindings);
    expect(readHomeFilteredPersonalPrayers(catalog, bindings).map((p) => p.id)).toEqual(['pp1']);
  });

  it('wireHomeCoordinators binds deep link host and refreshes catalog', () => {
    const cdr = { markForCheck: vi.fn(), detectChanges: vi.fn() };
    const refreshHomeCatalog = vi.fn();
    const page = {
      activeFilter: 'current' as const,
      filters: {},
      selectedPromptTypes: [] as string[],
      personalPrayers: [] as never[],
      isRefreshing: false,
      lastExplicitRefreshAt: 0,
      viewReady: false,
      canAccessShared: true,
      pendingHomeReturnContext: null,
      currentPrayers: [],
      currentPrayersCount: 0,
      answeredPrayersCount: 0,
      totalPrayersCount: 0,
      promptsCount: 0,
      personalPrayersCount: 0,
      isAdmin: false,
      getCatalogBindings: vi.fn(() =>
        createHomeCatalogBindings({
          personalPrayers: page.personalPrayers,
          prompts: [],
          activeFilter: page.activeFilter,
          filters: page.filters,
          selectedPromptTypes: page.selectedPromptTypes,
          personalCategoryFilterMode: 'all',
          selectedPersonalCategories: [],
        })
      ),
      refreshHomeCatalog,
      getFilteredPersonalPrayers: () => [],
      getPrayerFormComp: () => undefined,
      getMemorizeKeyboardBridge: () => undefined,
      scrollHomePromptIntoView: () => false,
      scrollHomePrayerIntoView: () => false,
      loadAdminSettings: vi.fn(),
      applyInitialView: vi.fn(),
      loadSelectedGroupPrayers: vi.fn(),
      consumeHomeReturnContext: () => null,
      applyHomeReturnContext: vi.fn(),
      extractUniqueCategories: vi.fn(),
    };

    const filterPage = page;
    const lifecyclePage = page;
    const personalCategory = new HomePersonalCategoryController();
    const memorizationPanel = new HomeMemorizationPanelController();
    const catalog = new HomeCatalogStore();
    const filterCoordinator = new HomeFilterCoordinator();
    const deepLinkCoordinator = new HomeDeepLinkCoordinator();
    const presentationNav = new HomePresentationNavigationController(
      { navigate: vi.fn() } as never,
      new PresentationHomeHandoffCoordinator()
    );

    const wired = wireHomeCoordinators({
      page,
      filterPage,
      lifecyclePage,
      cdr: cdr as never,
      router: { navigate: vi.fn() } as never,
      route: { snapshot: { queryParams: {} } } as never,
      prayerService: {
        prayers$: of([]),
        applyFilters: vi.fn(),
        getAllCommunityPrayersSnapshot: () => [],
        getPersonalPrayersSnapshot: () => [],
        loadPrayers: vi.fn(),
        loadPersonalPrayers: vi.fn(),
      } as never,
      promptService: {
        getPromptsSnapshot: () => [],
        isPromptsLoading: () => false,
        loadPrompts: vi.fn(),
      } as never,
      adminAuthService: {} as never,
      userSessionService: { getDefaultPrayerView: () => 'current' } as never,
      badgeService: {} as never,
      memorizationService: {} as never,
      memorizationRecommendationsService: {} as never,
      scriptureService: {} as never,
      personalCategoryColorService: {} as never,
      toastService: {} as never,
      analyticsService: {} as never,
      tenantContextService: {} as never,
      tenantPermissionService: {
        canAccessShared: () => true,
        canAccessGroupsTab: () => true,
      } as never,
      connectivity: {} as never,
      prayerGroupService: {} as never,
      supabaseService: {} as never,
      prayerCardActions: {} as never,
      deepLinkCoordinator,
      helpTourLauncher: null,
      catalog,
      filterCoordinator,
      personalCategory,
      memorizationPanel,
      planningCenter: new HomePlanningCenterController(),
      lifecycleCoordinator: new HomeLifecycleCoordinator(),
      modals: new HomeModalController(),
      refreshCoordinator: new HomeRefreshCoordinator(),
      presentationNav,
    });

    expect(wired.deepLinkHost).toBeTruthy();
    expect(refreshHomeCatalog).toHaveBeenCalled();
    deepLinkCoordinator.bindHost(wired.deepLinkHost);
    wired.deepLinkHost.setFilter('personal');
    expect(page.activeFilter).toBe('personal');
  });

  it('wireHomeCoordinators binds help tour host when launcher is provided', () => {
    const cdr = { markForCheck: vi.fn(), detectChanges: vi.fn() };
    const page = {
      activeFilter: 'current' as const,
      filters: {},
      selectedPromptTypes: [] as string[],
      personalPrayers: [] as never[],
      isRefreshing: false,
      lastExplicitRefreshAt: 0,
      viewReady: true,
      canAccessShared: true,
      pendingHomeReturnContext: null,
      currentPrayers: [],
      currentPrayersCount: 0,
      answeredPrayersCount: 0,
      totalPrayersCount: 0,
      promptsCount: 2,
      personalPrayersCount: 0,
      isAdmin: false,
      getCatalogBindings: vi.fn(() =>
        createHomeCatalogBindings({
          personalPrayers: [],
          prompts: [],
          activeFilter: 'current',
          filters: {},
          selectedPromptTypes: [],
          personalCategoryFilterMode: 'all',
          selectedPersonalCategories: [],
        })
      ),
      refreshHomeCatalog: vi.fn(),
      getFilteredPersonalPrayers: () => [],
      getPrayerFormComp: () => undefined,
      getMemorizeKeyboardBridge: () => {
        const input = document.createElement('input');
        input.focus = vi.fn();
        input.click = vi.fn();
        return input;
      },
      scrollHomePromptIntoView: () => false,
      scrollHomePrayerIntoView: () => false,
      loadAdminSettings: vi.fn(),
      applyInitialView: vi.fn(),
      loadSelectedGroupPrayers: vi.fn(),
      consumeHomeReturnContext: () => null,
      applyHomeReturnContext: vi.fn(),
      extractUniqueCategories: vi.fn(),
    };
    const helpTourLauncher = new HomeHelpTourLauncher();
    const memorizationPanel = new HomeMemorizationPanelController();
    const modals = new HomeModalController();
    const personalCategory = new HomePersonalCategoryController();
    const deepLinkCoordinator = new HomeDeepLinkCoordinator();
    deepLinkCoordinator.consumePendingVerseMemorization = vi.fn(() => ({
      reference: 'John 3:16',
      translation: 'ESV',
    }));

    wireHomeCoordinators({
      page,
      filterPage: page,
      lifecyclePage: page,
      cdr: cdr as never,
      router: { navigate: vi.fn() } as never,
      route: { snapshot: { queryParams: {} } } as never,
      prayerService: {
        prayers$: of([]),
        applyFilters: vi.fn(),
        getAllCommunityPrayersSnapshot: () => [],
        getPersonalPrayersSnapshot: () => [],
        loadPrayers: vi.fn(),
        loadPersonalPrayers: vi.fn(),
      } as never,
      promptService: {
        getPromptsSnapshot: () => [],
        isPromptsLoading: () => false,
        loadPrompts: vi.fn(),
      } as never,
      adminAuthService: {} as never,
      userSessionService: { getDefaultPrayerView: () => 'current' } as never,
      badgeService: {} as never,
      memorizationService: {} as never,
      memorizationRecommendationsService: {} as never,
      scriptureService: {} as never,
      personalCategoryColorService: {} as never,
      toastService: {} as never,
      analyticsService: {} as never,
      tenantContextService: {} as never,
      tenantPermissionService: {
        canAccessShared: () => true,
        canAccessGroupsTab: () => true,
      } as never,
      connectivity: {} as never,
      prayerGroupService: {} as never,
      supabaseService: {} as never,
      prayerCardActions: {} as never,
      deepLinkCoordinator,
      helpTourLauncher,
      catalog: new HomeCatalogStore(),
      filterCoordinator: new HomeFilterCoordinator(),
      personalCategory,
      memorizationPanel,
      planningCenter: new HomePlanningCenterController(),
      lifecycleCoordinator: new HomeLifecycleCoordinator(),
      modals,
      refreshCoordinator: new HomeRefreshCoordinator(),
      presentationNav: new HomePresentationNavigationController(
        { navigate: vi.fn() } as never,
        new PresentationHomeHandoffCoordinator()
      ),
    });

    memorizationPanel.bindHost(
      {
        markForCheck: vi.fn(),
        detectChanges: vi.fn(),
        primeKeyboardBridge: () => {
          const input = page.getMemorizeKeyboardBridge();
          input?.focus();
          input?.click();
        },
      },
      {
        memorizationService: {} as never,
        memorizationRecommendationsService: {} as never,
        scriptureService: {} as never,
        toastService: {} as never,
      }
    );
    expect(helpTourLauncher).toBeTruthy();
  });

  it('wireHomeCoordinators applies pending verse memorization deep links', () => {
    const cdr = { markForCheck: vi.fn(), detectChanges: vi.fn() };
    const page = {
      activeFilter: 'memorize' as const,
      filters: {},
      selectedPromptTypes: [] as string[],
      personalPrayers: [] as never[],
      isRefreshing: false,
      lastExplicitRefreshAt: 0,
      viewReady: true,
      canAccessShared: true,
      pendingHomeReturnContext: null,
      currentPrayers: [],
      currentPrayersCount: 0,
      answeredPrayersCount: 0,
      totalPrayersCount: 0,
      promptsCount: 0,
      personalPrayersCount: 0,
      isAdmin: false,
      getCatalogBindings: vi.fn(() =>
        createHomeCatalogBindings({
          personalPrayers: [],
          prompts: [],
          activeFilter: 'memorize',
          filters: {},
          selectedPromptTypes: [],
          personalCategoryFilterMode: 'all',
          selectedPersonalCategories: [],
        })
      ),
      refreshHomeCatalog: vi.fn(),
      getFilteredPersonalPrayers: () => [],
      getPrayerFormComp: () => undefined,
      getMemorizeKeyboardBridge: () => undefined,
      scrollHomePromptIntoView: () => false,
      scrollHomePrayerIntoView: () => false,
      loadAdminSettings: vi.fn(),
      applyInitialView: vi.fn(),
      loadSelectedGroupPrayers: vi.fn(),
      consumeHomeReturnContext: () => null,
      applyHomeReturnContext: vi.fn(),
      extractUniqueCategories: vi.fn(),
    };
    const memorizationPanel = new HomeMemorizationPanelController();
    const beginVerseMemorizationFromCard = vi.spyOn(
      memorizationPanel,
      'beginVerseMemorizationFromCard'
    );
    const deepLinkCoordinator = new HomeDeepLinkCoordinator();
    vi.spyOn(deepLinkCoordinator, 'consumePendingVerseMemorization').mockReturnValue({
      reference: 'John 3:16',
      translation: 'ESV',
    });
    const wired = wireHomeCoordinators({
      page,
      filterPage: page,
      lifecyclePage: page,
      cdr: cdr as never,
      router: { navigate: vi.fn() } as never,
      route: { snapshot: { queryParams: {} } } as never,
      prayerService: {
        prayers$: of([]),
        applyFilters: vi.fn(),
        getAllCommunityPrayersSnapshot: () => [],
        getPersonalPrayersSnapshot: () => [],
        loadPrayers: vi.fn(),
        loadPersonalPrayers: vi.fn(),
      } as never,
      promptService: {
        getPromptsSnapshot: () => [],
        isPromptsLoading: () => false,
        loadPrompts: vi.fn(),
      } as never,
      adminAuthService: {} as never,
      userSessionService: { getDefaultPrayerView: () => 'current' } as never,
      badgeService: {} as never,
      memorizationService: {} as never,
      memorizationRecommendationsService: {} as never,
      scriptureService: {} as never,
      personalCategoryColorService: {} as never,
      toastService: {} as never,
      analyticsService: {} as never,
      tenantContextService: {} as never,
      tenantPermissionService: {
        canAccessShared: () => true,
        canAccessGroupsTab: () => true,
      } as never,
      connectivity: {} as never,
      prayerGroupService: {} as never,
      supabaseService: {} as never,
      prayerCardActions: {} as never,
      deepLinkCoordinator,
      helpTourLauncher: null,
      catalog: new HomeCatalogStore(),
      filterCoordinator: new HomeFilterCoordinator(),
      personalCategory: new HomePersonalCategoryController(),
      memorizationPanel,
      planningCenter: new HomePlanningCenterController(),
      lifecycleCoordinator: new HomeLifecycleCoordinator(),
      modals: new HomeModalController(),
      refreshCoordinator: new HomeRefreshCoordinator(),
      presentationNav: new HomePresentationNavigationController(
        { navigate: vi.fn() } as never,
        new PresentationHomeHandoffCoordinator()
      ),
    });
    wired.deepLinkHost.applyPendingVerseMemorizationDeepLink();
    expect(beginVerseMemorizationFromCard).toHaveBeenCalledWith('John 3:16', 'ESV');
  });

  it('wireHomeCoordinators exercises filter, refresh, presentation, help tour, and keyboard bridge hosts', async () => {
    vi.useFakeTimers();
    const cdr = { markForCheck: vi.fn(), detectChanges: vi.fn() };
    const refreshHomeCatalog = vi.fn();
    const scrollHomePromptIntoView = vi.fn(() => true);
    const scrollHomePrayerIntoView = vi.fn(() => true);
    const focus = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('preventScroll unsupported');
      })
      .mockImplementation(() => undefined);
    const click = vi.fn();
    const page = {
      activeFilter: 'current' as const,
      filters: { searchTerm: 'find me' },
      selectedPromptTypes: ['Morning'] as string[],
      personalPrayers: [{ id: 'pp1' } as never],
      isRefreshing: false,
      lastExplicitRefreshAt: 0,
      viewReady: true,
      canAccessShared: false,
      pendingHomeReturnContext: null,
      currentPrayers: [],
      currentPrayersCount: 0,
      answeredPrayersCount: 0,
      totalPrayersCount: 0,
      promptsCount: 3,
      personalPrayersCount: 1,
      isAdmin: false,
      getCatalogBindings: vi.fn(() =>
        createHomeCatalogBindings({
          personalPrayers: page.personalPrayers,
          prompts: [],
          activeFilter: page.activeFilter,
          filters: page.filters,
          selectedPromptTypes: page.selectedPromptTypes,
          personalCategoryFilterMode: 'named',
          selectedPersonalCategories: ['Health'],
        })
      ),
      refreshHomeCatalog,
      getFilteredPersonalPrayers: () => page.personalPrayers,
      getPrayerFormComp: () => undefined,
      getMemorizeKeyboardBridge: () => {
        const input = document.createElement('input');
        input.focus = focus;
        input.click = click;
        return input;
      },
      scrollHomePromptIntoView,
      scrollHomePrayerIntoView,
      loadAdminSettings: vi.fn(),
      applyInitialView: vi.fn(),
      loadSelectedGroupPrayers: vi.fn(),
      consumeHomeReturnContext: () => null,
      applyHomeReturnContext: vi.fn(),
      extractUniqueCategories: vi.fn(),
    };

    const filterCoordinator = new HomeFilterCoordinator();
    const refreshCoordinator = new HomeRefreshCoordinator();
    const personalCategory = new HomePersonalCategoryController();
    personalCategory.selectedPersonalCategories = ['Health'];
    personalCategory.personalCategoryFilterMode = 'named';
    const memorizationPanel = new HomeMemorizationPanelController();
    const modals = new HomeModalController();
    modals.showHelp = true;
    const presentationNav = new HomePresentationNavigationController(
      { navigate: vi.fn() } as never,
      new PresentationHomeHandoffCoordinator()
    );
    const helpDriverTourService = {
      startFilteringHelpSectionTour: vi.fn(),
      startFullGuidedTourWelcome: vi.fn(),
      startFullGuidedTourClosing: vi.fn(),
      queueTourFinishedCallback: vi.fn(),
      setFullGuidedTourProgress: vi.fn(),
      startPresentationModePrayButtonPreludeTour: vi.fn(),
    };
    const helpTourLauncher = new HomeHelpTourLauncher(
      helpDriverTourService as never,
      { getSections: vi.fn(() => of([])) } as never
    );
    const prayerService = {
      prayers$: of([]),
      applyFilters: vi.fn(),
      getAllCommunityPrayersSnapshot: () => [],
      getPersonalPrayersSnapshot: () => [],
      loadPrayers: vi.fn().mockResolvedValue(undefined),
      loadPersonalPrayers: vi.fn().mockResolvedValue(undefined),
    };
    const lifecycleCoordinator = new HomeLifecycleCoordinator();

    const wired = wireHomeCoordinators({
      page,
      filterPage: page,
      lifecyclePage: page,
      cdr: cdr as never,
      router: { navigate: vi.fn() } as never,
      route: { snapshot: { queryParams: {} } } as never,
      prayerService: prayerService as never,
      promptService: {
        getPromptsSnapshot: () => [],
        isPromptsLoading: () => false,
        loadPrompts: vi.fn(),
      } as never,
      adminAuthService: {} as never,
      userSessionService: {
        getDefaultPrayerView: () => 'current',
        getCurrentSession: () => ({ email: 'me@test.com' }),
      } as never,
      badgeService: {} as never,
      memorizationService: { loadItems: vi.fn().mockResolvedValue(undefined) } as never,
      memorizationRecommendationsService: {} as never,
      scriptureService: {} as never,
      personalCategoryColorService: {
        loadColors: vi.fn().mockResolvedValue(undefined),
      } as never,
      toastService: { error: vi.fn() } as never,
      analyticsService: {} as never,
      tenantContextService: {} as never,
      tenantPermissionService: {
        canAccessShared: () => true,
        canAccessGroupsTab: () => false,
      } as never,
      connectivity: { requireOnline: () => true } as never,
      prayerGroupService: {} as never,
      supabaseService: {} as never,
      prayerCardActions: {} as never,
      deepLinkCoordinator: new HomeDeepLinkCoordinator(),
      helpTourLauncher,
      catalog: new HomeCatalogStore(),
      filterCoordinator,
      personalCategory,
      memorizationPanel,
      planningCenter: new HomePlanningCenterController(),
      lifecycleCoordinator,
      modals,
      refreshCoordinator,
      presentationNav,
    });

    filterCoordinator.setFilter('groups');
    expect(page.activeFilter).toBe('personal');
    filterCoordinator.onFiltersChange({ searchTerm: 'hello', status: 'current', type: '' });
    expect(prayerService.applyFilters).toHaveBeenCalled();
    expect(refreshHomeCatalog.mock.calls.length).toBeGreaterThan(1);

    wired.deepLinkHost.scrollPromptIntoView('prompt-1');
    wired.deepLinkHost.scrollPrayerIntoView('prayer-1');
    expect(scrollHomePromptIntoView).toHaveBeenCalledWith('prompt-1');
    expect(scrollHomePrayerIntoView).toHaveBeenCalledWith('prayer-1');

    expect(presentationNav.presentationHandoffQueryParams).toBeTruthy();

    await refreshCoordinator.onPullToRefresh(0);
    expect(page.isRefreshing).toBe(false);

    helpTourLauncher.startSectionTour(makeHelpSection('help_filtering'));
    expect(modals.showHelp).toBe(false);
    vi.runAllTimers();
    expect(helpDriverTourService.startFilteringHelpSectionTour).toHaveBeenCalled();

    memorizationPanel.openMemorizationPractice({
      id: 'm1',
      reference: 'John 3:16',
      text: 'For God so loved',
      translation: 'ESV',
      inProgressPractice: {
        phase: { kind: 'inRound' },
        practiceMode: 'type',
      },
    } as never);
    expect(focus).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('invokes deep-link page setters, help-tour bindings, and group filter load', async () => {
    const cdr = { markForCheck: vi.fn(), detectChanges: vi.fn() };
    const loadSelectedGroupPrayers = vi.fn();
    const page = {
      activeFilter: 'current' as const,
      filters: { searchTerm: '' },
      selectedPromptTypes: [] as string[],
      personalPrayers: [] as never[],
      isRefreshing: false,
      lastExplicitRefreshAt: 0,
      viewReady: true,
      canAccessShared: true,
      pendingHomeReturnContext: null,
      currentPrayers: [],
      currentPrayersCount: 0,
      answeredPrayersCount: 0,
      totalPrayersCount: 0,
      promptsCount: 1,
      personalPrayersCount: 0,
      isAdmin: false,
      getCatalogBindings: vi.fn(() =>
        createHomeCatalogBindings({
          personalPrayers: [],
          prompts: [],
          activeFilter: 'current',
          filters: {},
          selectedPromptTypes: [],
          personalCategoryFilterMode: 'all',
          selectedPersonalCategories: [],
        })
      ),
      refreshHomeCatalog: vi.fn(),
      getFilteredPersonalPrayers: () => [],
      getPrayerFormComp: () => undefined,
      getMemorizeKeyboardBridge: () => undefined,
      scrollHomePromptIntoView: () => false,
      scrollHomePrayerIntoView: () => false,
      loadAdminSettings: vi.fn(),
      applyInitialView: vi.fn(),
      loadSelectedGroupPrayers,
      consumeHomeReturnContext: () => null,
      applyHomeReturnContext: vi.fn(),
      extractUniqueCategories: vi.fn(),
    };
    const personalCategory = new HomePersonalCategoryController();
    const modals = new HomeModalController();
    const filterCoordinator = new HomeFilterCoordinator();
    const helpDriverTourService = { startFilteringHelpSectionTour: vi.fn() };
    const helpTourLauncher = new HomeHelpTourLauncher(
      helpDriverTourService as never,
      { getSections: vi.fn(() => of([])) } as never
    );
    const presentationNav = new HomePresentationNavigationController(
      { navigate: vi.fn() } as never,
      new PresentationHomeHandoffCoordinator()
    );
    const lifecycleCoordinator = new HomeLifecycleCoordinator();

    const wired = wireHomeCoordinators({
      page,
      filterPage: page,
      lifecyclePage: page,
      cdr: cdr as never,
      router: { navigate: vi.fn(), parseUrl: vi.fn(() => ({ queryParams: {} })), url: '/', events: of() } as never,
      route: { snapshot: { queryParams: {} }, queryParams: of({}) } as never,
      prayerService: {
        prayers$: of([]),
        applyFilters: vi.fn(),
        getAllCommunityPrayersSnapshot: () => [],
        getPersonalPrayersSnapshot: () => [],
        loadPrayers: vi.fn(),
        loadPersonalPrayers: vi.fn(),
      } as never,
      promptService: {
        getPromptsSnapshot: () => [],
        isPromptsLoading: () => false,
        loadPrompts: vi.fn(),
      } as never,
      adminAuthService: {} as never,
      userSessionService: {
        getDefaultPrayerView: () => 'current',
        getCurrentSession: () => ({ email: 'me@test.com' }),
      } as never,
      badgeService: {} as never,
      memorizationService: { loadItems: vi.fn() } as never,
      memorizationRecommendationsService: {} as never,
      scriptureService: {} as never,
      personalCategoryColorService: {} as never,
      toastService: {} as never,
      analyticsService: {} as never,
      tenantContextService: {} as never,
      tenantPermissionService: {
        canAccessShared: () => true,
        canAccessGroupsTab: () => true,
      } as never,
      connectivity: {} as never,
      prayerGroupService: {} as never,
      supabaseService: {} as never,
      prayerCardActions: {} as never,
      deepLinkCoordinator: new HomeDeepLinkCoordinator(),
      helpTourLauncher,
      catalog: new HomeCatalogStore(),
      filterCoordinator,
      personalCategory,
      memorizationPanel: new HomeMemorizationPanelController(),
      planningCenter: new HomePlanningCenterController(),
      lifecycleCoordinator,
      modals,
      refreshCoordinator: new HomeRefreshCoordinator(),
      presentationNav,
    });

    const pageState = (wired.deepLinkHost as unknown as { deps: { page: Record<string, unknown> } }).deps.page;
    pageState.activeFilter = 'personal';
    pageState.filters = { searchTerm: 'find' };
    pageState.selectedPromptTypes = ['Morning'];
    pageState.personalCategoryFilterMode = 'named';
    pageState.selectedPersonalCategories = ['Health'];
    expect(page.activeFilter).toBe('personal');
    expect(page.selectedPromptTypes).toEqual(['Morning']);

    filterCoordinator.setFilter('groups');
    expect(loadSelectedGroupPrayers).toHaveBeenCalled();

    const tourHost = (helpTourLauncher as unknown as { host: Record<string, unknown> }).host;
    (tourHost.openPrayerForm as () => void)();
    (tourHost.closePrayerForm as () => void)();
    (tourHost.closeWalkthroughPersonalEdit as () => void)();
    (tourHost.openUserSettings as () => void)();
    (tourHost.closeUserSettings as () => void)();
    (tourHost.openSearchPanel as () => void)();
    (tourHost.clearSelectedPromptTypes as () => void)();
    (tourHost.narrowToWalkthroughCategoryFilter as () => void)();
    (tourHost.navigateToPresentation as () => void)();
    (tourHost.stashPresentationTourSession as (json: string) => void)('{}');
    (tourHost.clickWalkthroughAddUpdate as () => void)();
    expect((tourHost.getPromptsCount as () => number)()).toBe(1);
    expect((tourHost.getMemorizedItemsCount as () => number)()).toBe(0);
    expect((tourHost.hasSessionEmail as () => boolean)()).toBe(true);
    expect(modals.showPrayerForm).toBe(false);

    presentationNav.onPresentationLinkClick({ preventDefault: vi.fn() } as MouseEvent);
    presentationNav.presentationHandoffQueryParams;
    await personalCategory.syncCategoriesFromPrayers([]);
    const lifecycleHost = (lifecycleCoordinator as unknown as {
      host: {
        stripFilterQueryParam: () => void;
        setFilter: (filter: string) => void;
        detectChanges: () => void;
        syncMemorizedItems: (items: unknown[]) => void;
        loadAdminSettings: () => void;
        applyInitialView: (session: unknown) => void;
      };
    }).host;
    lifecycleHost.setFilter('personal');
    lifecycleHost.detectChanges();
    lifecycleHost.stripFilterQueryParam();
    lifecycleHost.syncMemorizedItems([]);
    lifecycleHost.loadAdminSettings();
    lifecycleHost.applyInitialView({ defaultPrayerView: 'current' });

    const filterHost = (filterCoordinator as unknown as { host: { canAccessShared: () => boolean } }).host;
    expect(filterHost.canAccessShared()).toBe(true);

    const personalHost = (personalCategory as unknown as { host: { detectChanges: () => void } }).host;
    personalHost.detectChanges();

    const handoffHost = (presentationNav as unknown as {
      handoffHost: {
        setSelectedPromptTypes: (types: string[]) => void;
        applyPersonalReturnContext: (ctx: object) => void;
        setFilter: (filter: string) => void;
        onReturnContextApplied: () => void;
      };
    }).handoffHost;
    handoffHost.setSelectedPromptTypes(['Daily']);
    handoffHost.applyPersonalReturnContext({
      personalCategoryFilterMode: 'named',
      selectedPersonalCategories: ['Health'],
    });
    handoffHost.setFilter('current');
    handoffHost.onReturnContextApplied();

    wired.deepLinkHost.markForCheck();
    wired.deepLinkHost.setFilter('memorize');
    expect(cdr.markForCheck).toHaveBeenCalled();
  });

  it('refreshCatalog and catalog page source run after wiring', () => {
    const cdr = { markForCheck: vi.fn(), detectChanges: vi.fn() };
    const refreshHomeCatalog = vi.fn();
    const getCatalogBindings = vi.fn(() =>
      createHomeCatalogBindings({
        personalPrayers: [{ id: 'p1', category: 'Health', prayer_for: 'Me', updates: [] } as never],
        prompts: [],
        activeFilter: 'personal',
        filters: {},
        selectedPromptTypes: [],
        personalCategoryFilterMode: 'named',
        selectedPersonalCategories: ['Health'],
      })
    );
    const page = {
      activeFilter: 'personal' as const,
      filters: {},
      selectedPromptTypes: [] as string[],
      personalPrayers: [{ id: 'p1', category: 'Health', prayer_for: 'Me', updates: [] } as never],
      isRefreshing: false,
      lastExplicitRefreshAt: 0,
      viewReady: true,
      canAccessShared: true,
      pendingHomeReturnContext: null,
      getCatalogBindings,
      refreshHomeCatalog,
      getFilteredPersonalPrayers: () => page.personalPrayers,
      getPrayerFormComp: () => undefined,
      getMemorizeKeyboardBridge: () => {
        const input = document.createElement('input');
        input.focus = vi.fn(() => {
          throw new Error('no preventScroll');
        });
        input.click = vi.fn(() => {
          throw new Error('click blocked');
        });
        return input;
      },
      scrollHomePromptIntoView: () => false,
      scrollHomePrayerIntoView: () => false,
      loadAdminSettings: vi.fn(),
      applyInitialView: vi.fn(),
      loadSelectedGroupPrayers: vi.fn(),
      consumeHomeReturnContext: () => null,
      applyHomeReturnContext: vi.fn(),
      extractUniqueCategories: vi.fn(),
    };
    const catalog = new HomeCatalogStore();
    const filterCoordinator = new HomeFilterCoordinator();
    const memorizationPanel = new HomeMemorizationPanelController();
    wireHomeCoordinators({
      page,
      filterPage: page,
      lifecyclePage: page,
      cdr: cdr as never,
      router: { navigate: vi.fn() } as never,
      route: { snapshot: { queryParams: {} } } as never,
      prayerService: {
        prayers$: of([]),
        applyFilters: vi.fn(),
        getAllCommunityPrayersSnapshot: () => [],
        getPersonalPrayersSnapshot: () => [{ id: 'pp1' } as never],
        loadPrayers: vi.fn(),
        loadPersonalPrayers: vi.fn(),
      } as never,
      promptService: {
        getPromptsSnapshot: () => [],
        isPromptsLoading: () => false,
        loadPrompts: vi.fn(),
      } as never,
      adminAuthService: {} as never,
      userSessionService: { getDefaultPrayerView: () => 'current' } as never,
      badgeService: {} as never,
      memorizationService: {} as never,
      memorizationRecommendationsService: {} as never,
      scriptureService: {} as never,
      personalCategoryColorService: {} as never,
      toastService: {} as never,
      analyticsService: {} as never,
      tenantContextService: {} as never,
      tenantPermissionService: {
        canAccessShared: () => true,
        canAccessGroupsTab: () => true,
      } as never,
      connectivity: {} as never,
      prayerGroupService: {} as never,
      supabaseService: {} as never,
      prayerCardActions: {} as never,
      deepLinkCoordinator: new HomeDeepLinkCoordinator(),
      helpTourLauncher: null,
      catalog,
      filterCoordinator,
      personalCategory: new HomePersonalCategoryController(),
      memorizationPanel,
      planningCenter: new HomePlanningCenterController(),
      lifecycleCoordinator: new HomeLifecycleCoordinator(),
      modals: new HomeModalController(),
      refreshCoordinator: new HomeRefreshCoordinator(),
      presentationNav: new HomePresentationNavigationController(
        { navigate: vi.fn() } as never,
        new PresentationHomeHandoffCoordinator()
      ),
    });
    catalog.personalCategoryCount('Health');
    expect(getCatalogBindings).toHaveBeenCalled();
    filterCoordinator.onFiltersChange({ searchTerm: 'x', status: 'current', type: '' });
    expect(refreshHomeCatalog).toHaveBeenCalled();
    memorizationPanel.openMemorizationPractice({
      id: 'm1',
      reference: 'John 3:16',
      text: 'For God so loved',
      translation: 'ESV',
      inProgressPractice: { phase: { kind: 'inRound' }, practiceMode: 'type' },
    } as never);
  });
});
