import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  PRAY_FOR_MODAL_DO_NOT_SHOW_KEY,
  persistPrayForModalDoNotShowAgain,
  shouldSkipPrayForExplanationModal,
} from './prayer-card-pray-for-modal';

describe('prayer-card-pray-for-modal', () => {
  beforeEach(() => localStorage.removeItem(PRAY_FOR_MODAL_DO_NOT_SHOW_KEY));
  afterEach(() => localStorage.removeItem(PRAY_FOR_MODAL_DO_NOT_SHOW_KEY));

  it('reads and persists do-not-show flag', () => {
    expect(shouldSkipPrayForExplanationModal()).toBe(false);
    persistPrayForModalDoNotShowAgain();
    expect(shouldSkipPrayForExplanationModal()).toBe(true);
  });
});
