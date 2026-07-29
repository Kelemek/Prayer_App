import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_HOME_HANDOFF_STATE_KEY,
  PRESENTATION_HOME_NAV_STATE_KEY,
  PRESENTATION_HOME_PERSONAL_CATS_QUERY_PARAM_KEY,
  PRESENTATION_HOME_PROMPT_CATS_QUERY_PARAM_KEY,
  PRESENTATION_HOME_QUERY_PARAM_KEY,
  PRESENTATION_HOME_STATUS_QUERY_PARAM_KEY,
  buildPresentationHomeHandoff,
  HOME_RETURN_CONTEXT_STATE_KEY,
  mapHomeTabToPresentationStatusFilters,
  parseHomeReturnContextFromState,
  parsePresentationHomeHandoffFromQueryParams,
  parsePresentationHomeHandoffFromState,
  serializePresentationHomeHandoffQueryParams,
} from './presentation';

describe('mapHomeTabToPresentationStatusFilters', () => {
  it('maps current, answered, and total tabs', () => {
    expect(mapHomeTabToPresentationStatusFilters('current')).toEqual({
      current: true,
      answered: false,
    });
    expect(mapHomeTabToPresentationStatusFilters('answered')).toEqual({
      current: false,
      answered: true,
    });
    expect(mapHomeTabToPresentationStatusFilters('total')).toEqual({
      current: false,
      answered: false,
    });
  });
});

describe('buildPresentationHomeHandoff', () => {
  it('includes prayer status filters for current, answered, and total tabs', () => {
    expect(
      buildPresentationHomeHandoff({
        contentTypes: ['prayers'],
        activeFilter: 'answered',
      }).statusFilters
    ).toEqual({ current: false, answered: true });
  });

  it('includes prompt categories when a prompt type is selected', () => {
    expect(
      buildPresentationHomeHandoff({
        contentTypes: ['prompts'],
        activeFilter: 'prompts',
        selectedPromptTypes: ['Church'],
      })
    ).toEqual({
      contentTypes: ['prompts'],
      promptCategories: ['Church'],
      returnContext: {
        activeFilter: 'prompts',
        selectedPromptTypes: ['Church'],
      },
    });
  });

  it('includes personal categories when a category chip is selected', () => {
    expect(
      buildPresentationHomeHandoff({
        contentTypes: ['personal'],
        activeFilter: 'personal',
        selectedPersonalCategories: ['Evening'],
      })
    ).toEqual({
      contentTypes: ['personal'],
      personalCategories: ['Evening'],
      returnContext: {
        activeFilter: 'personal',
        selectedPersonalCategories: ['Evening'],
      },
    });
  });

  it('includes return context for restoring Home after presentation exit', () => {
    expect(
      buildPresentationHomeHandoff({
        contentTypes: ['prompts'],
        activeFilter: 'prompts',
        selectedPromptTypes: ['Church'],
      }).returnContext
    ).toEqual({
      activeFilter: 'prompts',
      selectedPromptTypes: ['Church'],
    });
  });
});

describe('parseHomeReturnContextFromState', () => {
  it('reads return context from router state', () => {
    expect(
      parseHomeReturnContextFromState({
        [HOME_RETURN_CONTEXT_STATE_KEY]: {
          activeFilter: 'personal',
          selectedPersonalCategories: ['Evening'],
        },
      })
    ).toEqual({
      activeFilter: 'personal',
      selectedPersonalCategories: ['Evening'],
    });
  });
});

describe('parsePresentationHomeHandoffFromState', () => {
  it('reads the new handoff object from router state', () => {
    expect(
      parsePresentationHomeHandoffFromState({
        [PRESENTATION_HOME_HANDOFF_STATE_KEY]: {
          contentTypes: ['prayers'],
          statusFilters: { current: false, answered: true },
        },
      })
    ).toEqual({
      contentTypes: ['prayers'],
      statusFilters: { current: false, answered: true },
    });
  });

  it('supports legacy content-type-only state', () => {
    expect(
      parsePresentationHomeHandoffFromState({
        [PRESENTATION_HOME_NAV_STATE_KEY]: ['prompts'],
      })
    ).toEqual({ contentTypes: ['prompts'] });
  });
});

describe('presentation home handoff query params', () => {
  it('round-trips status and category filters', () => {
    const handoff = buildPresentationHomeHandoff({
      contentTypes: ['prompts'],
      activeFilter: 'prompts',
      selectedPromptTypes: ['Family, Friends'],
    });
    const params = serializePresentationHomeHandoffQueryParams(handoff);
    expect(params[PRESENTATION_HOME_QUERY_PARAM_KEY]).toBe('prompts');
    expect(params[PRESENTATION_HOME_PROMPT_CATS_QUERY_PARAM_KEY]).toBe(
      encodeURIComponent('Family, Friends')
    );

    const parsed = parsePresentationHomeHandoffFromQueryParams(
      (key) => params[key] ?? null
    );
    expect(parsed).toEqual({
      contentTypes: ['prompts'],
      promptCategories: ['Family, Friends'],
      returnContext: {
        activeFilter: 'prompts',
        selectedPromptTypes: ['Family, Friends'],
      },
    });
  });

  it('round-trips return context for new-tab navigation', () => {
    const handoff = buildPresentationHomeHandoff({
      contentTypes: ['personal'],
      activeFilter: 'personal',
      selectedPersonalCategories: ['Evening'],
    });
    const params = serializePresentationHomeHandoffQueryParams(handoff);
    expect(params.homeReturnFilter).toBe('personal');
    expect(params.homePersonalCats).toBe('Evening');

    const parsed = parsePresentationHomeHandoffFromQueryParams(
      (key) => params[key] ?? null
    );
    expect(parsed?.returnContext).toEqual({
      activeFilter: 'personal',
      selectedPersonalCategories: ['Evening'],
    });
  });

  it('serializes answered status for new-tab navigation', () => {
    const params = serializePresentationHomeHandoffQueryParams({
      contentTypes: ['prayers'],
      statusFilters: { current: false, answered: true },
    });
    expect(params[PRESENTATION_HOME_STATUS_QUERY_PARAM_KEY]).toBe('answered');

    const parsed = parsePresentationHomeHandoffFromQueryParams((key) => {
      if (key === PRESENTATION_HOME_QUERY_PARAM_KEY) return 'prayers';
      if (key === PRESENTATION_HOME_STATUS_QUERY_PARAM_KEY) return 'answered';
      return null;
    });
    expect(parsed?.statusFilters).toEqual({ current: false, answered: true });
  });

  it('serializes personal categories for new-tab navigation', () => {
    const params = serializePresentationHomeHandoffQueryParams({
      contentTypes: ['personal'],
      personalCategories: ['Morning'],
    });
    expect(params[PRESENTATION_HOME_PERSONAL_CATS_QUERY_PARAM_KEY]).toBe(
      'Morning'
    );
  });
});
