import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApplicationRef, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { MemorizationRecommendationsManagerComponent } from './memorization-recommendations-manager.component';
import type {
  MemorizationRecommendation,
  MemorizationRecommendationCategory,
  MemorizationRecommendationCategoryGroup,
} from '../../types/memorization';

const TENANT_ID = 'tenant-1';

function makeCategory(
  id: string,
  name: string,
  displayOrder = 0
): MemorizationRecommendationCategory {
  return {
    id,
    tenantId: TENANT_ID,
    name,
    displayOrder,
    catalogSource: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function makeRecommendation(
  id: string,
  reference: string,
  categoryId: string,
  displayOrder = 0
): MemorizationRecommendation {
  return {
    id,
    tenantId: TENANT_ID,
    reference,
    categoryId,
    displayOrder,
    catalogSource: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function makeGroups(): MemorizationRecommendationCategoryGroup[] {
  const cat1 = makeCategory('cat-1', 'Gospel');
  const cat2 = makeCategory('cat-2', 'Prayer', 1);
  return [
    {
      category: cat1,
      items: [makeRecommendation('rec-1', 'John 3:16', cat1.id)],
    },
    { category: cat2, items: [] },
  ];
}

describe('MemorizationRecommendationsManagerComponent', () => {
  let component: MemorizationRecommendationsManagerComponent;
  let activeTenant$: Subject<{ id: string } | null>;
  let groupsSnapshot: MemorizationRecommendationCategoryGroup[];
  let load: ReturnType<typeof vi.fn>;
  let addCategory: ReturnType<typeof vi.fn>;
  let renameCategory: ReturnType<typeof vi.fn>;
  let deleteCategory: ReturnType<typeof vi.fn>;
  let addRecommendation: ReturnType<typeof vi.fn>;
  let removeRecommendation: ReturnType<typeof vi.fn>;
  let reorderCategories: ReturnType<typeof vi.fn>;
  let persistVersePlacements: ReturnType<typeof vi.fn>;
  let getPassage: ReturnType<typeof vi.fn>;
  let getPreferredTranslation: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn>; detectChanges: ReturnType<typeof vi.fn> };
  let mockAppRef: { tick: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    activeTenant$ = new Subject();
    groupsSnapshot = makeGroups();
    load = vi.fn().mockResolvedValue(undefined);
    addCategory = vi.fn();
    renameCategory = vi.fn();
    deleteCategory = vi.fn();
    addRecommendation = vi.fn();
    removeRecommendation = vi.fn();
    reorderCategories = vi.fn();
    persistVersePlacements = vi.fn();
    getPassage = vi.fn().mockResolvedValue({ text: 'For God so loved the world…' });
    getPreferredTranslation = vi.fn().mockReturnValue('esv');
    toastSuccess = vi.fn();
    toastError = vi.fn();
    mockCdr = { markForCheck: vi.fn(), detectChanges: vi.fn() };
    mockAppRef = { tick: vi.fn() };

    component = new MemorizationRecommendationsManagerComponent(
      {
        load,
        get groupedSnapshot() {
          return groupsSnapshot;
        },
        addCategory,
        renameCategory,
        deleteCategory,
        addRecommendation,
        removeRecommendation,
        reorderCategories,
        persistVersePlacements,
      } as any,
      { getPassage } as any,
      { getPreferredTranslation } as any,
      { success: toastSuccess, error: toastError } as any,
      {
        getActiveTenant: vi.fn(() => ({ id: TENANT_ID })),
        activeTenant$,
      } as any,
      mockCdr as unknown as ChangeDetectorRef,
      mockAppRef as unknown as ApplicationRef
    );
  });

  it('initializes active tenant and preferred translation', () => {
    expect(component.activeTenantId).toBe(TENANT_ID);
    expect(component.previewTranslation).toBe('esv');
    expect(getPreferredTranslation).toHaveBeenCalled();
  });

  it('uses picker translation for preview when set', () => {
    component.pickerTranslation = 'niv';
    expect(component.previewTranslation).toBe('niv');
  });

  it('loads data when section expands with an active tenant', async () => {
    component.onExpandedChange(true);
    await vi.waitFor(() => expect(load).toHaveBeenCalledWith(true));
    expect(component.loadedOnce).toBe(true);
    expect(component.loading).toBe(false);
    expect(component.addTargetCategoryId).toBe('cat-1');
    expect(component.groups).toHaveLength(2);
  });

  it('does not load when expanded without a tenant', () => {
    component.activeTenantId = null;
    component.onExpandedChange(true);
    expect(load).not.toHaveBeenCalled();
  });

  it('reloads when tenant changes while expanded', async () => {
    component.sectionExpanded = true;
    activeTenant$.next({ id: 'tenant-2' });
    await vi.waitFor(() => expect(load).toHaveBeenCalledWith(true));
    expect(component.activeTenantId).toBe('tenant-2');
    expect(component.loadedOnce).toBe(true);
  });

  it('openPicker requires a selected category', () => {
    component.openPicker();
    expect(toastError).toHaveBeenCalledWith('Select a category first.');
    expect(component.showPicker).toBe(false);
  });

  it('openPicker opens when a category is selected', () => {
    component.addTargetCategoryId = 'cat-1';
    component.openPicker();
    expect(component.showPicker).toBe(true);
    expect(getPreferredTranslation).toHaveBeenCalled();
  });

  it('selectAddTarget updates target category', () => {
    component.selectAddTarget('cat-2');
    expect(component.addTargetCategoryId).toBe('cat-2');
    expect(mockCdr.markForCheck).toHaveBeenCalled();
  });

  it('submitAddCategory handles success and error reasons', async () => {
    addCategory.mockResolvedValue({
      ok: true,
      category: makeCategory('cat-new', 'New'),
    });
    component.newCategoryName = 'New';
    await component.submitAddCategory();
    expect(toastSuccess).toHaveBeenCalledWith('Category added.');
    expect(component.showAddCategory).toBe(false);
    expect(component.addTargetCategoryId).toBe('cat-new');

    addCategory.mockResolvedValue({ ok: false, reason: 'duplicate' });
    component.newCategoryName = 'Dup';
    await component.submitAddCategory();
    expect(toastError).toHaveBeenCalledWith('A category with that name already exists.');

    addCategory.mockResolvedValue({ ok: false, reason: 'empty_name' });
    await component.submitAddCategory();
    expect(toastError).toHaveBeenCalledWith('Enter a category name.');

    addCategory.mockResolvedValue({ ok: false, reason: 'no_tenant' });
    await component.submitAddCategory();
    expect(toastError).toHaveBeenCalledWith('Select an organization first.');

    addCategory.mockResolvedValue({ ok: false, reason: 'unknown' });
    await component.submitAddCategory();
    expect(toastError).toHaveBeenCalledWith('Could not add category.');
  });

  it('submitAddCategory returns early while saving', async () => {
    component.savingCategory = true;
    await component.submitAddCategory();
    expect(addCategory).not.toHaveBeenCalled();
  });

  it('rename flow updates and cancels', async () => {
    const category = makeCategory('cat-1', 'Gospel');
    component.startRename(category);
    expect(component.editingCategoryId).toBe('cat-1');
    expect(component.editingCategoryName).toBe('Gospel');

    component.cancelRename();
    expect(component.editingCategoryId).toBeNull();

    component.startRename(category);
    component.editingCategoryName = 'Good News';
    renameCategory.mockResolvedValue({ ok: true });
    await component.saveRenameCategory(category);
    expect(toastSuccess).toHaveBeenCalledWith('Category renamed.');
    expect(component.editingCategoryId).toBeNull();

    renameCategory.mockResolvedValue({ ok: false, reason: 'duplicate' });
    component.startRename(category);
    await component.saveRenameCategory(category);
    expect(toastError).toHaveBeenCalledWith('A category with that name already exists.');

    renameCategory.mockResolvedValue({ ok: false, reason: 'error' });
    await component.saveRenameCategory(category);
    expect(toastError).toHaveBeenCalledWith('Could not rename category.');
  });

  it('doRemoveCategory handles success, not_empty, and errors', async () => {
    const category = makeCategory('cat-2', 'Prayer');
    component.confirmRemoveCategory(category);
    expect(component.pendingRemoveCategory).toBe(category);

    deleteCategory.mockResolvedValue({ ok: true });
    component.addTargetCategoryId = 'cat-2';
    await component.doRemoveCategory();
    expect(toastSuccess).toHaveBeenCalledWith('Category deleted.');
    expect(component.addTargetCategoryId).toBeNull();

    component.confirmRemoveCategory(category);
    deleteCategory.mockResolvedValue({ ok: false, reason: 'not_empty' });
    await component.doRemoveCategory();
    expect(toastError).toHaveBeenCalledWith(
      'Move or remove verses before deleting this category.'
    );

    component.confirmRemoveCategory(category);
    deleteCategory.mockResolvedValue({ ok: false, reason: 'error' });
    await component.doRemoveCategory();
    expect(toastError).toHaveBeenCalledWith('Could not delete category.');

    const callsBeforeNull = deleteCategory.mock.calls.length;
    component.pendingRemoveCategory = null;
    await component.doRemoveCategory();
    expect(deleteCategory.mock.calls.length).toBe(callsBeforeNull);
  });

  it('onPassageConfirmed adds recommendation on success', async () => {
    component.addTargetCategoryId = 'cat-1';
    addRecommendation.mockResolvedValue({ ok: true });
    await component.onPassageConfirmed('John 3:16');
    expect(getPassage).toHaveBeenCalledWith('John 3:16', 'esv');
    expect(addRecommendation).toHaveBeenCalledWith('John 3:16', 'cat-1');
    expect(toastSuccess).toHaveBeenCalledWith('Recommendation added.');
    expect(component.showPicker).toBe(false);
    expect(component.adding).toBe(false);
  });

  it('onPassageConfirmed handles validation and service errors', async () => {
    component.addTargetCategoryId = 'cat-1';

    getPassage.mockResolvedValue({ text: '   ' });
    await component.onPassageConfirmed('John 3:16');
    expect(toastError).toHaveBeenCalledWith('No text returned for this passage.');

    getPassage.mockResolvedValue({ text: 'Verse text' });
    addRecommendation.mockResolvedValue({ ok: false, reason: 'duplicate' });
    await component.onPassageConfirmed('John 3:16');
    expect(toastError).toHaveBeenCalledWith('That passage is already in recommendations.');

    addRecommendation.mockResolvedValue({ ok: false, reason: 'missing_category' });
    await component.onPassageConfirmed('John 3:16');
    expect(toastError).toHaveBeenCalledWith('Select a category first.');

    addRecommendation.mockResolvedValue({ ok: false, reason: 'no_tenant' });
    await component.onPassageConfirmed('John 3:16');
    expect(toastError).toHaveBeenCalledWith('Select an organization first.');

    addRecommendation.mockResolvedValue({ ok: false, reason: 'unknown' });
    await component.onPassageConfirmed('John 3:16');
    expect(toastError).toHaveBeenCalledWith('Could not save this recommendation.');

    getPassage.mockRejectedValue(new Error('network'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await component.onPassageConfirmed('John 3:16');
    expect(toastError).toHaveBeenCalledWith('Could not validate this passage.');
    consoleError.mockRestore();
  });

  it('onPassageConfirmed returns early without target or while adding', async () => {
    await component.onPassageConfirmed('John 3:16');
    expect(getPassage).not.toHaveBeenCalled();

    component.addTargetCategoryId = 'cat-1';
    component.adding = true;
    await component.onPassageConfirmed('John 3:16');
    expect(getPassage).not.toHaveBeenCalled();
  });

  it('doRemoveVerse removes recommendation', async () => {
    const item = makeRecommendation('rec-1', 'John 3:16', 'cat-1');
    component.confirmRemoveVerse(item);
    removeRecommendation.mockResolvedValue(true);
    await component.doRemoveVerse();
    expect(toastSuccess).toHaveBeenCalledWith('Recommendation removed.');

    component.confirmRemoveVerse(item);
    removeRecommendation.mockResolvedValue(false);
    await component.doRemoveVerse();
    expect(toastError).toHaveBeenCalledWith('Could not remove recommendation.');

    component.pendingRemoveVerse = null;
    await component.doRemoveVerse();
    expect(removeRecommendation).toHaveBeenCalledTimes(2);
  });

  it('onIbcdCatalogChanged reselects first category when target is missing', () => {
    component.addTargetCategoryId = 'missing';
    component.onIbcdCatalogChanged();
    expect(component.addTargetCategoryId).toBe('cat-1');
    expect(component.groups).toHaveLength(2);
  });

  it('onCategoryDrop reorders categories and rolls back on failure', async () => {
    component.groups = structuredClone(groupsSnapshot);
    reorderCategories.mockResolvedValue(true);
    await component.onCategoryDrop({
      previousIndex: 0,
      currentIndex: 1,
    } as CdkDragDrop<MemorizationRecommendationCategoryGroup[]>);
    expect(reorderCategories).toHaveBeenCalledWith(['cat-2', 'cat-1']);

    component.groups = structuredClone(groupsSnapshot);
    const original = [...component.groups];
    reorderCategories.mockResolvedValue(false);
    await component.onCategoryDrop({
      previousIndex: 0,
      currentIndex: 1,
    } as CdkDragDrop<MemorizationRecommendationCategoryGroup[]>);
    expect(component.groups.map((g) => g.category.id)).toEqual(
      original.map((g) => g.category.id)
    );
    expect(toastError).toHaveBeenCalledWith('Could not reorder categories.');

    component.reorderingCategories = true;
    await component.onCategoryDrop({
      previousIndex: 0,
      currentIndex: 1,
    } as CdkDragDrop<MemorizationRecommendationCategoryGroup[]>);
    expect(reorderCategories).toHaveBeenCalledTimes(2);
  });

  it('onVerseDrop reorders within a list and moves across lists', async () => {
    component.groups = structuredClone(groupsSnapshot);
    const group = component.groups[0];
    const listContainer = { data: group.items, id: 'rec-verses-cat-1' };
    const event = {
      previousContainer: listContainer,
      container: listContainer,
      previousIndex: 0,
      currentIndex: 0,
    } as CdkDragDrop<MemorizationRecommendation[]>;
    await component.onVerseDrop(event, 'cat-1');
    expect(persistVersePlacements).not.toHaveBeenCalled();

    const rec2 = makeRecommendation('rec-2', 'Romans 8:28', 'cat-1', 1);
    group.items.push(rec2);
    event.previousIndex = 0;
    event.currentIndex = 1;
    persistVersePlacements.mockResolvedValue(true);
    await component.onVerseDrop(event, 'cat-1');
    expect(persistVersePlacements).toHaveBeenCalled();
    expect(group.items[0].id).toBe('rec-2');

    const source = component.groups[0];
    const target = component.groups[1];
    const moveEvent = {
      previousContainer: { data: source.items, id: 'rec-verses-cat-1' },
      container: { data: target.items, id: 'rec-verses-cat-2' },
      previousIndex: 0,
      currentIndex: 0,
    } as CdkDragDrop<MemorizationRecommendation[]>;
    persistVersePlacements.mockResolvedValue(false);
    await component.onVerseDrop(moveEvent, 'cat-2');
    expect(toastError).toHaveBeenCalledWith('Could not move verse to that category.');

    component.reorderingVerses = true;
    await component.onVerseDrop(moveEvent, 'cat-2');
    expect(persistVersePlacements).toHaveBeenCalledTimes(2);
  });

  it('ngOnDestroy completes subscription subject', () => {
    const nextSpy = vi.spyOn((component as any).destroy$, 'next');
    const completeSpy = vi.spyOn((component as any).destroy$, 'complete');
    component.ngOnDestroy();
    expect(nextSpy).toHaveBeenCalled();
    expect(completeSpy).toHaveBeenCalled();
  });
});
