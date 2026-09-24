import { describe, it, expect, vi } from 'vitest';
import { createHomeDeepLinkPageState } from './home-deep-link-page.adapter';
import type { HomePersonalCategoryController } from './home-personal-category.controller';

describe('createHomeDeepLinkPageState', () => {
  it('proxies filter, filters, prompt types, and personal category fields', () => {
    const personalCategory = {
      personalCategoryFilterMode: 'all' as const,
      selectedPersonalCategories: ['work'],
    } as HomePersonalCategoryController;

    const source = {
      getActiveFilter: vi.fn(() => 'current' as const),
      setActiveFilter: vi.fn(),
      getFilters: vi.fn(() => ({ searchTerm: 'hello', status: 'current', type: 'all' })),
      setFilters: vi.fn(),
      getSelectedPromptTypes: vi.fn(() => ['type-a']),
      setSelectedPromptTypes: vi.fn(),
      personalCategory,
    };

    const state = createHomeDeepLinkPageState(source);

    expect(state.activeFilter).toBe('current');
    state.activeFilter = 'personal';
    expect(source.setActiveFilter).toHaveBeenCalledWith('personal');

    expect(state.filters.searchTerm).toBe('hello');
    state.filters = { searchTerm: 'next', status: 'answered', type: 'all' };
    expect(source.setFilters).toHaveBeenCalled();

    expect(state.selectedPromptTypes).toEqual(['type-a']);
    state.selectedPromptTypes = ['b'];
    expect(source.setSelectedPromptTypes).toHaveBeenCalledWith(['b']);

    expect(state.personalCategoryFilterMode).toBe('all');
    state.personalCategoryFilterMode = 'selected';
    expect(personalCategory.personalCategoryFilterMode).toBe('selected');

    expect(state.selectedPersonalCategories).toEqual(['work']);
    state.selectedPersonalCategories = ['family'];
    expect(personalCategory.selectedPersonalCategories).toEqual(['family']);
  });
});
