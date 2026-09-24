import { describe, expect, it, vi } from 'vitest';
import { HomePresentationHandoffHostAdapter } from './home-presentation-handoff-host.adapter';

describe('HomePresentationHandoffHostAdapter', () => {
  it('delegates to page bindings', () => {
    const page = {
      setFilter: vi.fn(),
      setSelectedPromptTypes: vi.fn(),
      applyPersonalReturnContext: vi.fn(),
      refreshHomeCatalog: vi.fn(),
    };
    const adapter = new HomePresentationHandoffHostAdapter(page);
    adapter.setFilter('personal');
    adapter.setSelectedPromptTypes(['a']);
    adapter.applyPersonalReturnContext({ selectedPersonalCategories: ['x'] });
    adapter.onReturnContextApplied();
    expect(page.setFilter).toHaveBeenCalledWith('personal');
    expect(page.refreshHomeCatalog).toHaveBeenCalled();
  });
});
