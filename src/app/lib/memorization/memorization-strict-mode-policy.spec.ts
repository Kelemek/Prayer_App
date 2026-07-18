import { describe, expect, it } from 'vitest';
import type { MemorizationStrictModeSessionContext } from './memorization-strict-mode-policy';
import {
  MEMORIZATION_MAX_WRONG_BEFORE_REVEAL,
  hydratedRoundCompletedWithErrors,
  isAutoRevealBlocked,
  mustRepeatDueToErrors,
  mustRepeatFinalRound,
  resolveHydratedWrongAttemptsInRound,
  shouldAutoFinishFinalRoundAfterSessionLoad,
  shouldAutoRevealToken,
  shouldCountReorderWrongSwap,
  shouldDeferFinalRoundUntilSessionInit,
  showFinishPracticeOption,
  showNextRoundOption,
  strictModeToggleSetsRoundCompletedWithErrors,
} from './memorization-strict-mode-policy';

function ctx(
  strictModeEnabled: boolean,
  sessionInitialized: boolean
): MemorizationStrictModeSessionContext {
  return { strictModeEnabled, sessionInitialized };
}

describe('memorization-strict-mode-policy', () => {
  it('resolveHydratedWrongAttemptsInRound treats missing as zero', () => {
    expect(
      resolveHydratedWrongAttemptsInRound({
        sessionSeed: 's',
        wrongAttempts: 2,
        correctKeystrokes: 0,
        phase: { kind: 'inRound', roundIndex: 1 },
      })
    ).toBe(0);
    expect(
      resolveHydratedWrongAttemptsInRound({
        sessionSeed: 's',
        wrongAttempts: 2,
        wrongAttemptsInRound: 3,
        correctKeystrokes: 0,
        phase: { kind: 'betweenRounds', completedRoundIndex: 2 },
      })
    ).toBe(3);
  });

  describe('isAutoRevealBlocked / shouldAutoRevealToken', () => {
    it.each([
      { strict: true, init: true, blocked: true },
      { strict: true, init: false, blocked: true },
      { strict: false, init: false, blocked: true },
      { strict: false, init: true, blocked: false },
    ])('strict=$strict init=$init => blocked=$blocked', ({ strict, init, blocked }) => {
      expect(isAutoRevealBlocked(ctx(strict, init))).toBe(blocked);
    });

    it('reveals only after threshold in standard mode with session loaded', () => {
      const ready = ctx(false, true);
      expect(shouldAutoRevealToken(MEMORIZATION_MAX_WRONG_BEFORE_REVEAL - 1, ready)).toBe(
        false
      );
      expect(shouldAutoRevealToken(MEMORIZATION_MAX_WRONG_BEFORE_REVEAL, ready)).toBe(
        true
      );
      expect(
        shouldAutoRevealToken(MEMORIZATION_MAX_WRONG_BEFORE_REVEAL, ctx(true, true))
      ).toBe(false);
    });
  });

  describe('mustRepeatDueToErrors', () => {
    it.each([
      { errors: 0, strict: false, init: true, repeat: false },
      { errors: 1, strict: false, init: false, repeat: true },
      { errors: 1, strict: false, init: true, repeat: false },
      { errors: 2, strict: true, init: true, repeat: true },
    ])(
      'errors=$errors strict=$strict init=$init => repeat=$repeat',
      ({ errors, strict, init, repeat }) => {
        expect(mustRepeatDueToErrors(errors, ctx(strict, init))).toBe(repeat);
      }
    );
  });

  describe('mustRepeatFinalRound', () => {
    it.each([
      { final: false, errors: 1, strict: true, init: true, repeat: false },
      { final: true, errors: 0, strict: true, init: true, repeat: false },
      { final: true, errors: 1, strict: false, init: false, repeat: true },
      { final: true, errors: 1, strict: false, init: true, repeat: false },
      { final: true, errors: 1, strict: true, init: true, repeat: true },
    ])(
      'final=$final errors=$errors strict=$strict init=$init => repeat=$repeat',
      ({ final, errors, strict, init, repeat }) => {
        expect(mustRepeatFinalRound(final, errors, ctx(strict, init))).toBe(repeat);
      }
    );
  });

  describe('showNextRoundOption', () => {
    it('hides on final round', () => {
      expect(
        showNextRoundOption({
          isFinalRound: true,
          roundCompletedWithErrors: false,
          wrongAttemptsInRound: 0,
          ctx: ctx(false, true),
        })
      ).toBe(false);
    });

    it('shows when round completed cleanly', () => {
      expect(
        showNextRoundOption({
          isFinalRound: false,
          roundCompletedWithErrors: false,
          wrongAttemptsInRound: 0,
          ctx: ctx(false, true),
        })
      ).toBe(true);
    });

    it('gates next round on strict repeat policy when errors occurred', () => {
      expect(
        showNextRoundOption({
          isFinalRound: false,
          roundCompletedWithErrors: true,
          wrongAttemptsInRound: 2,
          ctx: ctx(true, true),
        })
      ).toBe(false);
      expect(
        showNextRoundOption({
          isFinalRound: false,
          roundCompletedWithErrors: true,
          wrongAttemptsInRound: 2,
          ctx: ctx(false, true),
        })
      ).toBe(true);
    });
  });

  describe('showFinishPracticeOption', () => {
    it('allows finish on final round in standard mode after session loads', () => {
      expect(
        showFinishPracticeOption({
          awaitingRoundAdvance: true,
          isFinalRound: true,
          ctx: ctx(false, true),
        })
      ).toBe(true);
    });

    it.each([
      { awaiting: false, final: true, strict: false, init: true },
      { awaiting: true, final: false, strict: false, init: true },
      { awaiting: true, final: true, strict: true, init: true },
      { awaiting: true, final: true, strict: false, init: false },
    ])(
      'awaiting=$awaiting final=$final strict=$strict init=$init => false',
      ({ awaiting, final, strict, init }) => {
        expect(
          showFinishPracticeOption({
            awaitingRoundAdvance: awaiting,
            isFinalRound: final,
            ctx: ctx(strict, init),
          })
        ).toBe(false);
      }
    );
  });

  it('hydratedRoundCompletedWithErrors only between rounds with errors', () => {
    expect(hydratedRoundCompletedWithErrors('betweenRounds', 1)).toBe(true);
    expect(hydratedRoundCompletedWithErrors('betweenRounds', 0)).toBe(false);
    expect(hydratedRoundCompletedWithErrors('inRound', 2)).toBe(false);
  });

  it('strictModeToggleSetsRoundCompletedWithErrors', () => {
    expect(strictModeToggleSetsRoundCompletedWithErrors(true, true, 1)).toBe(true);
    expect(strictModeToggleSetsRoundCompletedWithErrors(false, true, 1)).toBe(false);
    expect(strictModeToggleSetsRoundCompletedWithErrors(true, false, 1)).toBe(false);
  });

  it('shouldDeferFinalRoundUntilSessionInit', () => {
    expect(shouldDeferFinalRoundUntilSessionInit(true, 1, false)).toBe(true);
    expect(shouldDeferFinalRoundUntilSessionInit(true, 0, false)).toBe(false);
    expect(shouldDeferFinalRoundUntilSessionInit(false, 1, false)).toBe(false);
    expect(shouldDeferFinalRoundUntilSessionInit(true, 1, true)).toBe(false);
  });

  it('shouldAutoFinishFinalRoundAfterSessionLoad', () => {
    const base = {
      deferFinalRoundUntilSessionInit: true,
      awaitingRoundAdvance: true,
      isFinalRound: true,
      wrongAttemptsInRound: 2,
      ctx: ctx(false, true),
    };
    expect(shouldAutoFinishFinalRoundAfterSessionLoad(base)).toBe(true);
    expect(
      shouldAutoFinishFinalRoundAfterSessionLoad({
        ...base,
        deferFinalRoundUntilSessionInit: false,
      })
    ).toBe(false);
    expect(
      shouldAutoFinishFinalRoundAfterSessionLoad({
        ...base,
        ctx: ctx(true, true),
      })
    ).toBe(false);
  });

  it('shouldCountReorderWrongSwap only in strict mode', () => {
    expect(shouldCountReorderWrongSwap(ctx(true, true))).toBe(true);
    expect(shouldCountReorderWrongSwap(ctx(false, true))).toBe(false);
  });
});
