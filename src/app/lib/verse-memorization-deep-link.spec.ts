import { describe, it, expect, vi } from 'vitest';
import { applyVerseMemorizationDeepLink } from './verse-memorization-deep-link';

describe('applyVerseMemorizationDeepLink', () => {
  it('consumes pending deep link and opens verse memorization flow', () => {
    const consumePending = vi.fn().mockReturnValue({
      reference: 'John 3:16',
      translation: 'esv',
    });
    const stripQueryParams = vi.fn();
    const beginFromCard = vi.fn();

    applyVerseMemorizationDeepLink({
      consumePending,
      stripQueryParams,
      beginFromCard,
    });

    expect(consumePending).toHaveBeenCalled();
    expect(stripQueryParams).toHaveBeenCalled();
    expect(beginFromCard).toHaveBeenCalledWith('John 3:16', 'esv');
  });

  it('does nothing when there is no pending deep link', () => {
    const stripQueryParams = vi.fn();
    const beginFromCard = vi.fn();

    applyVerseMemorizationDeepLink({
      consumePending: () => null,
      stripQueryParams,
      beginFromCard,
    });

    expect(stripQueryParams).not.toHaveBeenCalled();
    expect(beginFromCard).not.toHaveBeenCalled();
  });

  it('passes reference only when translation is absent', () => {
    const beginFromCard = vi.fn();

    applyVerseMemorizationDeepLink({
      consumePending: () => ({ reference: 'Romans 8:28' }),
      stripQueryParams: vi.fn(),
      beginFromCard,
    });

    expect(beginFromCard).toHaveBeenCalledWith('Romans 8:28', undefined);
  });
});
