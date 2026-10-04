import type { CardActionsOverflowTone } from '../components/card-actions-overflow-menu/card-actions-overflow-menu.types';

export const CARD_ACTIONS_OVERFLOW_BLUE_TONE_CLASS =
  'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20';

export const CARD_ACTIONS_OVERFLOW_GREEN_TONE_CLASS =
  'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20';

export const CARD_ACTIONS_OVERFLOW_GRAY_TONE_CLASS =
  'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/40';

/** Text + hover fill for overflow menu items with tone `red` (e.g. Delete prayer). */
export const CARD_ACTIONS_OVERFLOW_RED_TONE_CLASS =
  'text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20';

/** Memorize remove control: same red tone with transparent border for layout stability. */
export const MEMORIZE_REMOVE_BUTTON_TONE_CLASS =
  `border border-transparent ${CARD_ACTIONS_OVERFLOW_RED_TONE_CLASS}`;

const CARD_ACTIONS_OVERFLOW_TONE_CLASS: Record<CardActionsOverflowTone, string> =
  {
    blue: CARD_ACTIONS_OVERFLOW_BLUE_TONE_CLASS,
    green: CARD_ACTIONS_OVERFLOW_GREEN_TONE_CLASS,
    gray: CARD_ACTIONS_OVERFLOW_GRAY_TONE_CLASS,
    red: CARD_ACTIONS_OVERFLOW_RED_TONE_CLASS,
  };

export function getCardActionsOverflowToneClass(
  tone: CardActionsOverflowTone
): string {
  return CARD_ACTIONS_OVERFLOW_TONE_CLASS[tone];
}
