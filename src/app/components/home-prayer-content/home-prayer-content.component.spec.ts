import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { HomePrayerContentComponent } from './home-prayer-content.component';
import type { PrayerRequest } from '../../services/prayer.service';

const handlers = {
  onPersonalReorder: vi.fn(),
  onPersonalPrayerDrop: vi.fn(),
  onOpenPersonalPrayer: vi.fn(),
  onDeletePersonalPrayer: vi.fn(),
  onArchivePersonalPrayer: vi.fn(),
  onAnswerPersonalPrayer: vi.fn(),
  onEditPersonalPrayer: vi.fn(),
  onOpenPrayer: vi.fn(),
  onDeletePrayer: vi.fn(),
  onArchivePrayer: vi.fn(),
  onAnswerPrayer: vi.fn(),
  onEditPrayer: vi.fn(),
  onOpenPrompt: vi.fn(),
  onMemorizeVerse: vi.fn(),
  onRemoveMemorizedItem: vi.fn(),
  onOpenMemorizedItem: vi.fn(),
};

function createComponent(): HomePrayerContentComponent {
  const component = new HomePrayerContentComponent();
  component.contentHidden = false;
  component.activeFilter = 'current';
  component.filters = {};
  component.prayers$ = of([]);
  component.prompts$ = of([]);
  component.loading$ = of(false);
  component.error$ = of(null);
  component.isAdmin$ = of(false);
  component.deletionsAllowed = 'admins';
  component.updatesAllowed = 'admins';
  component.personalCategoryPickerPrayerId = null;
  component.personalWalkthroughPrayerFor = '';
  component.personalWalkthroughDescription = '';
  component.filteredPersonalPrayers = [];
  component.displayedPublicPrayers = [];
  component.displayedPrompts = [];
  component.loadingPersonalPrayers$ = of(false);
  component.canReorderPersonalPrayers = false;
  component.selectedPromptTypes = ['Morning'];
  component.memorizedItems = [];
  component.memorizeLoading$ = of(false);
  component.showAddMemorizedVerse = false;
  component.showAddMemorizedBibleBooks = false;
  component.showMemorizationRecommendations = false;
  component.handlers = handlers;
  component.canAccessShared = false;
  return component;
}

describe('HomePrayerContentComponent', () => {
  it('shows church demo panel when shared access is blocked', () => {
    const component = createComponent();
    expect(component.showChurchDemo).toBe(true);
  });

  it('resolves group name for group prayers', () => {
    const component = createComponent();
    component.prayerGroups = [{ id: 'g1', name: 'Family' } as never];
    const prayer = { id: 'p1', group_id: 'g1' } as PrayerRequest;
    expect(component.groupNameFor(prayer)).toBe('Family');
    expect(component.groupNameFor({ id: 'p2' } as PrayerRequest)).toBeNull();
  });

  it('tracks prompts and prayers by id', () => {
    const component = createComponent();
    expect(component.trackPrompt(0, { id: 'pr1' } as never)).toBe('pr1');
    expect(component.trackPrayer(0, { id: 'p1' } as never)).toBe('p1');
  });

  it('emits personal category picker open changes', () => {
    const component = createComponent();
    const spy = vi.fn();
    component.personalCategoryPickerOpenChange.subscribe(spy);
    component.onCategoryPickerOpenChange('p1', true);
    expect(spy).toHaveBeenCalledWith({ prayerId: 'p1', open: true });
  });

  it('returns false when scrolling prompts on the wrong filter', () => {
    const component = createComponent();
    component.canAccessShared = true;
    component.activeFilter = 'current';
    expect(component.scrollPromptIntoView('pr1')).toBe(false);
  });

  it('returns false when scrolling prayers in church demo mode', () => {
    const component = createComponent();
    component.displayedPublicPrayers = [{ id: 'p1' } as PrayerRequest];
    expect(component.scrollPrayerIntoView('p1')).toBe(false);
  });

  it('scrolls to an existing prompt element without virtual scroll', () => {
    const component = createComponent();
    component.canAccessShared = true;
    component.activeFilter = 'prompts';
    component.displayedPrompts = [{ id: 'pr1', title: 'T', type: 'Morning', description: '', created_at: '', updated_at: '' }];
    const el = document.createElement('div');
    el.id = 'prompt-card-pr1';
    document.body.appendChild(el);
    expect(component.scrollPromptIntoView('pr1')).toBe(true);
    el.remove();
  });

  it('scrolls community prayers when the card element is already mounted', () => {
    const component = createComponent();
    component.canAccessShared = true;
    component.activeFilter = 'current';
    component.displayedPublicPrayers = [{ id: 'p1' } as PrayerRequest];
    const el = document.createElement('div');
    el.id = 'prayer-card-p1';
    document.body.appendChild(el);
    const viewport = {
      measureScrollOffset: vi.fn(() => 0),
      scrollToOffset: vi.fn(),
      checkViewportSize: vi.fn(),
    };
    (component as { publicVirtualScrollViewport?: unknown }).publicVirtualScrollViewport =
      viewport;
    expect(component.scrollPrayerIntoView('p1')).toBe(true);
    el.remove();
  });

  it('reconcilePromptVirtualScrollSize no-ops without viewport', () => {
    const component = createComponent();
    component.canAccessShared = true;
    component.activeFilter = 'prompts';
    component.displayedPrompts = Array.from({ length: 30 }, (_, i) => ({
      id: `pr-${i}`,
      title: `Prompt ${i}`,
      type: 'Morning',
      description: '',
      created_at: '',
      updated_at: '',
    }));
    component.reconcilePromptVirtualScrollSize();
    expect(component.shouldUsePromptVirtualScroll(30)).toBe(true);
  });

  it('schedules prompt virtual scroll reconcile on prompt changes', () => {
    vi.useFakeTimers();
    const component = createComponent();
    component.canAccessShared = true;
    component.activeFilter = 'prompts';
    component.displayedPrompts = Array.from({ length: 30 }, (_, i) => ({
      id: `pr-${i}`,
      title: `Prompt ${i}`,
      type: 'Morning',
      description: '',
      created_at: '',
      updated_at: '',
    }));
    component.ngOnChanges({
      displayedPrompts: {
        currentValue: component.displayedPrompts,
        previousValue: [],
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    expect(component.isPromptTypeSelected('Morning')).toBe(true);
    vi.runAllTimers();
    vi.useRealTimers();
  });
});
