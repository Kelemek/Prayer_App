import type { MemorizationInProgress } from '../../types/memorization';

/** Wrong keystrokes in standard mode before the answer is auto-revealed. */
export const MEMORIZATION_MAX_WRONG_BEFORE_REVEAL = 3;

export type MemorizationStrictModeSessionContext = {
  strictModeEnabled: boolean;
  sessionInitialized: boolean;
};

/**
 * Legacy in-progress saves may omit per-round error counts; treat missing as zero
 * so session totals do not inflate the current round after resume.
 */
export function resolveHydratedWrongAttemptsInRound(
  inProgress: MemorizationInProgress
): number {
  return inProgress.wrongAttemptsInRound ?? 0;
}

/** Block auto-reveal until session bootstrap resolves strict vs standard. */
export function isAutoRevealBlocked(
  ctx: MemorizationStrictModeSessionContext
): boolean {
  return ctx.strictModeEnabled || !ctx.sessionInitialized;
}

export function shouldAutoRevealToken(
  consecutiveWrong: number,
  ctx: MemorizationStrictModeSessionContext
): boolean {
  if (isAutoRevealBlocked(ctx)) return false;
  return consecutiveWrong >= MEMORIZATION_MAX_WRONG_BEFORE_REVEAL;
}

/** Strict mode (or pending session) requires repeating after errors before advancing mid-run. */
export function mustRepeatDueToErrors(
  wrongAttemptsInRound: number,
  ctx: MemorizationStrictModeSessionContext
): boolean {
  if (wrongAttemptsInRound <= 0) return false;
  if (!ctx.sessionInitialized) return true;
  return ctx.strictModeEnabled;
}

/** Final round: defer until session loads, then repeat only in strict mode. */
export function mustRepeatFinalRound(
  isFinalRound: boolean,
  wrongAttemptsInRound: number,
  ctx: MemorizationStrictModeSessionContext
): boolean {
  if (!isFinalRound || wrongAttemptsInRound <= 0) return false;
  if (!ctx.sessionInitialized) return true;
  return ctx.strictModeEnabled;
}

export function showNextRoundOption(params: {
  isFinalRound: boolean;
  roundCompletedWithErrors: boolean;
  wrongAttemptsInRound: number;
  ctx: MemorizationStrictModeSessionContext;
}): boolean {
  if (params.isFinalRound) return false;
  if (!params.roundCompletedWithErrors) return true;
  return !mustRepeatDueToErrors(params.wrongAttemptsInRound, params.ctx);
}

/** Final round in standard mode: finish with errors after resume or strict-mode toggle. */
export function showFinishPracticeOption(params: {
  awaitingRoundAdvance: boolean;
  isFinalRound: boolean;
  ctx: MemorizationStrictModeSessionContext;
}): boolean {
  return (
    params.awaitingRoundAdvance &&
    params.isFinalRound &&
    params.ctx.sessionInitialized &&
    !params.ctx.strictModeEnabled
  );
}

export function hydratedRoundCompletedWithErrors(
  phaseKind: MemorizationInProgress['phase']['kind'],
  hydratedRoundErrors: number
): boolean {
  return phaseKind === 'betweenRounds' && hydratedRoundErrors > 0;
}

export function strictModeToggleSetsRoundCompletedWithErrors(
  strict: boolean,
  awaitingRoundAdvance: boolean,
  wrongAttemptsInRound: number
): boolean {
  return strict && awaitingRoundAdvance && wrongAttemptsInRound > 0;
}

export function shouldDeferFinalRoundUntilSessionInit(
  isFinalRound: boolean,
  wrongAttemptsInRound: number,
  sessionInitialized: boolean
): boolean {
  return isFinalRound && wrongAttemptsInRound > 0 && !sessionInitialized;
}

/** Standard mode on final round: auto-finish with errors once session bootstrap resolves. */
export function shouldAutoFinishFinalRoundAfterSessionLoad(params: {
  deferFinalRoundUntilSessionInit: boolean;
  awaitingRoundAdvance: boolean;
  isFinalRound: boolean;
  wrongAttemptsInRound: number;
  ctx: MemorizationStrictModeSessionContext;
}): boolean {
  if (!params.deferFinalRoundUntilSessionInit) return false;
  if (
    !params.awaitingRoundAdvance ||
    !params.isFinalRound ||
    params.wrongAttemptsInRound <= 0 ||
    params.ctx.strictModeEnabled
  ) {
    return false;
  }
  return true;
}

export function shouldCountReorderWrongSwap(
  ctx: MemorizationStrictModeSessionContext
): boolean {
  return ctx.strictModeEnabled;
}
