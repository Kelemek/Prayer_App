import type {
  MemorizationPracticeMode,
  MemorizedItem,
} from '../../types/memorization';

/** Modes that use the hidden keystroke capture input (software keyboard). */
export function isKeyboardPracticeMode(
  mode: MemorizationPracticeMode | null | undefined
): boolean {
  return mode === 'type' || mode === 'firstLetters';
}

/**
 * True when reopening this item should auto-open the mobile keyboard
 * (in-progress type / first-letters round, not between-rounds or other modes).
 */
export function memorizationNeedsKeyboardOnOpen(item: MemorizedItem): boolean {
  const ip = item.inProgressPractice;
  if (!ip || ip.phase.kind !== 'inRound') return false;
  return isKeyboardPracticeMode(ip.practiceMode ?? 'type');
}
