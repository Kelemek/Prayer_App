import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HomePresentationNavigationController } from './home-presentation-navigation.controller';

describe('HomePresentationNavigationController', () => {
  let controller: HomePresentationNavigationController;
  const coordinator = {
    getQueryParamsForLink: vi.fn(() => ({ filter: 'current' })),
    buildHandoffFromHome: vi.fn((src) => src),
    shouldUseNativePresentationNavigation: vi.fn(() => false),
    navigateToPresentation: vi.fn(),
    consumeHomeReturnContext: vi.fn(() => ({ filter: 'personal' })),
    applyHomeReturnContext: vi.fn(),
  };
  const router = { navigate: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new HomePresentationNavigationController(
      router as never,
      coordinator as never
    );
    controller.bindHost({
      setFilter: vi.fn(),
      setSelectedPromptTypes: vi.fn(),
      applyPersonalReturnContext: vi.fn(),
      refreshHomeCatalog: vi.fn(),
      getHandoffSource: () => ({
        activeFilter: 'current',
        selectedPromptTypes: [],
        selectedPersonalCategories: [],
        personalCategoryFilterMode: 'total',
        defaultPrayerView: 'current',
      }),
    });
  });

  it('exposes presentation handoff query params', () => {
    expect(controller.presentationHandoffQueryParams).toEqual({ filter: 'current' });
  });

  it('onPresentationLinkClick navigates when not native', () => {
    const event = { preventDefault: vi.fn() } as unknown as MouseEvent;
    controller.onPresentationLinkClick(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(coordinator.navigateToPresentation).toHaveBeenCalled();
  });

  it('consumeHomeReturnContext and applyHomeReturnContext delegate', () => {
    const ctx = controller.consumeHomeReturnContext();
    expect(ctx).toEqual({ filter: 'personal' });
    controller.applyHomeReturnContext(ctx as never);
    expect(coordinator.applyHomeReturnContext).toHaveBeenCalled();
  });
});
