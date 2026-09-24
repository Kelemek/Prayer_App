import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { HomePrayerContentComponent } from './home-prayer-content.component';
import type { PrayerRequest } from '../../services/prayer.service';
import type { HomePrayerContentHandlers } from '../../lib/home-prayer-content-handlers';

const componentDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(componentDir, '../..');

function findResourceInApp(fileName: string): string | null {
  const walk = (dir: string, depth: number): string | null => {
    if (depth > 8) {
      return null;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      const full = join(dir, entry.name);
      if (entry.isFile() && entry.name === fileName) {
        return full;
      }
      if (entry.isDirectory()) {
        const nested = walk(full, depth + 1);
        if (nested) {
          return nested;
        }
      }
    }
    return null;
  };
  return walk(appRoot, 0);
}

function readComponentResource(url: string): string {
  const localPath = join(componentDir, url);
  if (existsSync(localPath)) {
    return readFileSync(localPath, 'utf-8');
  }
  const fileName = url.replace(/^\.\//, '');
  const resolved = findResourceInApp(fileName);
  if (resolved) {
    return readFileSync(resolved, 'utf-8');
  }
  throw new Error(`Component resource not found: ${url}`);
}

const handlers: HomePrayerContentHandlers = {
  deleteCard: vi.fn(),
  deletePrompt: vi.fn(),
  onCardAddUpdate: vi.fn(),
  onCardDeleteUpdate: vi.fn(),
  requestDeletion: vi.fn(),
  requestUpdateDeletion: vi.fn(),
  toggleMemberUpdateAnswered: vi.fn(),
  editPersonalPrayer: vi.fn(),
  editPersonalUpdate: vi.fn(),
  togglePromptType: vi.fn(),
  onPersonalPrayerDrop: vi.fn(),
  openMemorizationAddVerses: vi.fn(),
  openMemorizationBibleBooks: vi.fn(),
  openMemorizationRecommendations: vi.fn(),
  openMemorizationPractice: vi.fn(),
  confirmRemoveMemorizedItem: vi.fn(),
  onCardMemorizeVerse: vi.fn(),
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
  component.loadingGroupPrayers$ = of(false);
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

async function mountPublicEmptyState(options: {
  loading$: BehaviorSubject<boolean>;
  contentHidden?: boolean;
}): Promise<ComponentFixture<HomePrayerContentComponent>> {
  const fixture = TestBed.createComponent(HomePrayerContentComponent);
  fixture.componentRef.setInput('contentHidden', options.contentHidden ?? false);
  fixture.componentRef.setInput('activeFilter', 'current');
  fixture.componentRef.setInput('filters', {});
  fixture.componentRef.setInput('prayers$', of([]));
  fixture.componentRef.setInput('prompts$', of([]));
  fixture.componentRef.setInput('loading$', options.loading$);
  fixture.componentRef.setInput('error$', of(null));
  fixture.componentRef.setInput('isAdmin$', of(false));
  fixture.componentRef.setInput('deletionsAllowed', 'admins');
  fixture.componentRef.setInput('updatesAllowed', 'admins');
  fixture.componentRef.setInput('personalCategoryPickerPrayerId', null);
  fixture.componentRef.setInput('personalWalkthroughPrayerFor', '');
  fixture.componentRef.setInput('personalWalkthroughDescription', '');
  fixture.componentRef.setInput('filteredPersonalPrayers', []);
  fixture.componentRef.setInput('displayedPublicPrayers', []);
  fixture.componentRef.setInput('displayedPrompts', []);
  fixture.componentRef.setInput('loadingPersonalPrayers$', of(false));
  fixture.componentRef.setInput('loadingGroupPrayers$', of(false));
  fixture.componentRef.setInput('canReorderPersonalPrayers', false);
  fixture.componentRef.setInput('selectedPromptTypes', []);
  fixture.componentRef.setInput('memorizedItems', []);
  fixture.componentRef.setInput('memorizeLoading$', of(false));
  fixture.componentRef.setInput('showAddMemorizedVerse', false);
  fixture.componentRef.setInput('showAddMemorizedBibleBooks', false);
  fixture.componentRef.setInput('showMemorizationRecommendations', false);
  fixture.componentRef.setInput('handlers', handlers);
  fixture.componentRef.setInput('canAccessShared', true);
  fixture.componentRef.setInput('groupPrayers', []);
  fixture.componentRef.setInput('prayerGroups', []);
  fixture.componentRef.setInput('filteredPlanningCenterPrayers', []);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('HomePrayerContentComponent', () => {
  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePrayerContentComponent],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });
  it('shows church demo panel when shared access is blocked', () => {
    const component = createComponent();
    expect(component.showChurchDemo).toBe(true);
  });

  it('hides public empty copy while community prayers are loading', async () => {
    const loading$ = new BehaviorSubject(true);
    const fixture = await mountPublicEmptyState({ loading$ });
    expect(fixture.nativeElement.textContent).not.toContain(
      'No current prayer requests yet'
    );
    fixture.destroy();
  });

  it('shows public empty copy after load when the list is empty', async () => {
    const loading$ = new BehaviorSubject(false);
    const fixture = await mountPublicEmptyState({ loading$ });
    expect(fixture.nativeElement.textContent).toContain(
      'No current prayer requests yet'
    );
    fixture.destroy();
  });

  it('hides public empty copy when content is hidden for loading', async () => {
    const loading$ = new BehaviorSubject(false);
    const fixture = await mountPublicEmptyState({
      loading$,
      contentHidden: true,
    });
    expect(fixture.nativeElement.textContent).not.toContain(
      'No current prayer requests yet'
    );
    fixture.destroy();
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
