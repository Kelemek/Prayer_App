import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { HomeHelpTourHostAdapter } from './home-help-tour-host.adapter';
import {
  PERSONAL_PRAYER_WALKTHROUGH_CATEGORY,
  PERSONAL_PRAYER_WALKTHROUGH_DESCRIPTION,
  PERSONAL_PRAYER_WALKTHROUGH_PRAYER_FOR,
  PRESENTATION_HELP_TOUR_SESSION_KEY,
} from './help-driver-tour.service';

describe('HomeHelpTourHostAdapter', () => {
  const bindings = {
    getActiveFilter: vi.fn(() => 'current' as const),
    getPromptsCount: vi.fn(() => 3),
    getMemorizedItemsCount: vi.fn(() => 2),
    getSelectedPromptTypes: vi.fn(() => ['a']),
    setSelectedPromptTypes: vi.fn(),
    getPersonalCategoryFilterMode: vi.fn(() => 'all' as const),
    setPersonalCategoryFilterMode: vi.fn(),
    getSelectedPersonalCategories: vi.fn(() => []),
    setSelectedPersonalCategories: vi.fn(),
    closeHelp: vi.fn(),
    openPrayerForm: vi.fn(),
    closePrayerForm: vi.fn(),
    closeWalkthroughPersonalEdit: vi.fn(),
  };

  const router = { navigate: vi.fn().mockResolvedValue(true) };
  const userSessionService = {
    getCurrentSession: vi.fn(() => ({ email: 'user@example.com' })),
  };
  const prayerCardActions = { deleteCard: vi.fn() };
  const refreshHomeCatalog = vi.fn();
  const setFilter = vi.fn();
  const openEditModal = vi.fn();

  let adapter: HomeHelpTourHostAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    adapter = new HomeHelpTourHostAdapter({
      bindings,
      router: router as never,
      userSessionService: userSessionService as never,
      prayers$: of([{ id: 'p1' } as never]),
      prayerCardActions: prayerCardActions as never,
      markForCheck: vi.fn(),
      setFilter,
      openUserSettings: vi.fn(),
      closeUserSettings: vi.fn(),
      openSearchPanel: vi.fn(),
      openEditModal,
      getFilteredPersonalPrayers: () => [
        {
          id: 'walk',
          prayer_for: PERSONAL_PRAYER_WALKTHROUGH_PRAYER_FOR,
          description: PERSONAL_PRAYER_WALKTHROUGH_DESCRIPTION,
        } as never,
      ],
      getPrayerFormHooks: () => null,
      refreshHomeCatalog,
    });
  });

  it('delegates bindings and clears prompt types', () => {
    expect(adapter.getActiveFilter()).toBe('current');
    adapter.setFilter('personal');
    expect(setFilter).toHaveBeenCalledWith('personal');
    adapter.clearSelectedPromptTypes();
    expect(bindings.setSelectedPromptTypes).toHaveBeenCalledWith([]);
    expect(refreshHomeCatalog).toHaveBeenCalled();
  });

  it('finds walkthrough prayer and deletes it', () => {
    const prayer = adapter.getWalkthroughPersonalPrayer();
    expect(prayer?.id).toBe('walk');
    adapter.deleteWalkthroughTestPrayer();
    expect(prayerCardActions.deleteCard).toHaveBeenCalledWith(prayer);
  });

  it('narrows personal category filter for walkthrough', () => {
    adapter.narrowToWalkthroughCategoryFilter();
    expect(bindings.setPersonalCategoryFilterMode).toHaveBeenCalledWith('named');
    expect(bindings.setSelectedPersonalCategories).toHaveBeenCalledWith([
      PERSONAL_PRAYER_WALKTHROUGH_CATEGORY,
    ]);
  });

  it('reads prayers and session email', async () => {
    expect(await adapter.getCurrentPrayers()).toEqual([{ id: 'p1' }]);
    expect(adapter.hasSessionEmail()).toBe(true);
  });

  it('returns empty prayers when stream errors', async () => {
    const failing = new HomeHelpTourHostAdapter({
      bindings,
      router: router as never,
      userSessionService: userSessionService as never,
      prayers$: throwError(() => new Error('fail')),
      prayerCardActions: prayerCardActions as never,
      markForCheck: vi.fn(),
      setFilter,
      openUserSettings: vi.fn(),
      closeUserSettings: vi.fn(),
      openSearchPanel: vi.fn(),
      openEditModal,
      getFilteredPersonalPrayers: () => [],
      getPrayerFormHooks: () => null,
      refreshHomeCatalog,
    });
    expect(await failing.getCurrentPrayers()).toEqual([]);
  });

  it('clicks the walkthrough add-update affordance when present', () => {
    const button = document.createElement('button');
    button.id = 'tour-walkthrough-add-update';
    const click = vi.fn();
    button.addEventListener('click', click);
    document.body.appendChild(button);
    adapter.clickWalkthroughAddUpdate();
    expect(click).toHaveBeenCalled();
    button.remove();
  });

  it('delegates modal, settings, and edit helpers', () => {
    const openUserSettings = vi.fn();
    const closeUserSettings = vi.fn();
    const openSearchPanel = vi.fn();
    const hooks = {
      fillWalkthroughPrayerFor: vi.fn(),
      fillWalkthroughDescription: vi.fn(),
      ensureWalkthroughPersonalSelected: vi.fn(),
      fillWalkthroughCategory: vi.fn(),
      submitWalkthroughPrayerForm: vi.fn(),
    };
    const withHooks = new HomeHelpTourHostAdapter({
      bindings,
      router: router as never,
      userSessionService: userSessionService as never,
      prayers$: of([]),
      prayerCardActions: prayerCardActions as never,
      markForCheck: vi.fn(),
      setFilter,
      openUserSettings,
      closeUserSettings,
      openSearchPanel,
      openEditModal,
      getFilteredPersonalPrayers: () => [],
      getPrayerFormHooks: () => hooks,
      refreshHomeCatalog,
    });
    withHooks.closeHelp();
    withHooks.openPrayerForm();
    withHooks.closePrayerForm();
    withHooks.openUserSettings();
    withHooks.closeUserSettings();
    withHooks.openSearchPanel();
    expect(withHooks.getPrayerFormHooks()).toBe(hooks);
    withHooks.openWalkthroughPersonalEdit({ id: 'walk' } as never);
    withHooks.closeWalkthroughPersonalEdit();
    expect(bindings.closeHelp).toHaveBeenCalled();
    expect(openEditModal).toHaveBeenCalled();
  });

  it('reports missing session email', () => {
    const noEmail = new HomeHelpTourHostAdapter({
      bindings,
      router: router as never,
      userSessionService: { getCurrentSession: () => null } as never,
      prayers$: of([]),
      prayerCardActions: prayerCardActions as never,
      markForCheck: vi.fn(),
      setFilter,
      openUserSettings: vi.fn(),
      closeUserSettings: vi.fn(),
      openSearchPanel: vi.fn(),
      openEditModal,
      getFilteredPersonalPrayers: () => [],
      getPrayerFormHooks: () => null,
      refreshHomeCatalog,
    });
    expect(noEmail.hasSessionEmail()).toBe(false);
    noEmail.deleteWalkthroughTestPrayer();
    expect(prayerCardActions.deleteCard).not.toHaveBeenCalled();
  });

  it('navigates to presentation and stashes tour session', () => {
    adapter.navigateToPresentation();
    expect(router.navigate).toHaveBeenCalledWith(['/presentation']);
    adapter.stashPresentationTourSession('{"step":1}');
    expect(sessionStorage.getItem(PRESENTATION_HELP_TOUR_SESSION_KEY)).toBe('{"step":1}');
  });
});
