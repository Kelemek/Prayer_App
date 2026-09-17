/** Interruptible color + press motion (no `transition-all`). */
export const UI_MOTION_INTERACTIVE =
  'transition-colors transition-transform duration-150 ease-out';

export const UI_PRESS_ACTIVE =
  'active:scale-[0.96] active:disabled:scale-100';

export const UI_FIELD_BORDER_TRANSITION =
  'transition-[border-color,box-shadow] duration-150 ease-out';

/** Layout + motion for bordered settings / modal choice tiles (pair with {@link settingsChoiceNgClass}). */
export const SETTINGS_CHOICE_BTN_CLASS =
  `flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-3 rounded-lg border-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${UI_MOTION_INTERACTIVE} ${UI_PRESS_ACTIVE}`;

export const SETTINGS_CHOICE_SELECTED_CLASS =
  'border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30';

export const SETTINGS_CHOICE_UNSELECTED_CLASS =
  'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20';

export const SETTINGS_CHOICE_DROPDOWN_SHELL_CLASS =
  'flex w-full min-w-0 rounded-lg border-2 overflow-hidden transition-colors duration-150 ease-out';

export const SETTINGS_CHOICE_DROPDOWN_TRIGGER_CLASS =
  'w-full flex items-center justify-between gap-2 p-2 sm:p-3 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-out';

export const SETTINGS_CHOICE_LIST_ROW_CLASS =
  `flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border-2 overflow-hidden ${SETTINGS_CHOICE_UNSELECTED_CLASS} transition-colors duration-150 ease-out`;

export const SETTINGS_CHOICE_REMOVE_BTN_CLASS =
  'self-stretch flex items-center justify-center px-3 border-l border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-medium text-red-600 dark:text-red-400 hover:bg-blue-100/60 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150 ease-out';

export const SETTINGS_CHOICE_SEGMENT_BTN_CLASS =
  `px-3 py-1.5 rounded-lg border-2 text-xs sm:text-sm font-medium cursor-pointer ${UI_MOTION_INTERACTIVE} ${UI_PRESS_ACTIVE}`;

export const SETTINGS_CHOICE_ACTION_ROW_CLASS =
  `w-full min-w-0 flex flex-row items-center justify-center gap-2 p-2 sm:p-3 rounded-lg border-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${SETTINGS_CHOICE_UNSELECTED_CLASS} ${UI_MOTION_INTERACTIVE} ${UI_PRESS_ACTIVE}`;

export const SETTINGS_CHOICE_SPLIT_TILE_BTN_CLASS =
  `flex-1 flex flex-col items-center justify-center gap-2 p-2 sm:p-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${UI_MOTION_INTERACTIVE} ${UI_PRESS_ACTIVE}`;

export const SETTINGS_CHOICE_SIDE_CHEVRON_BTN_CLASS =
  'flex items-center justify-center px-2 border-l border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-blue-100/60 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150 ease-out';

export const PRAYER_FORM_VISIBILITY_TILE_CLASS =
  `relative flex flex-col items-center justify-start py-3 px-4 rounded-lg border-2 font-medium cursor-pointer text-left ${UI_MOTION_INTERACTIVE} ${UI_PRESS_ACTIVE}`;

export const UI_COMPACT_DROPDOWN_SHELL_CLASS =
  'overflow-hidden rounded-lg border bg-white dark:bg-gray-800 transition-colors duration-150 ease-out';

export const UI_COMPACT_DROPDOWN_TRIGGER_CLASS =
  'flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 px-2 py-1 text-left transition-colors duration-150 ease-out';

export const UI_COMPACT_DROPDOWN_TRIGGER_TOUCH_CLASS =
  'flex w-full min-h-[44px] cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors duration-150 ease-out touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800';

export const UI_TENANT_DROPDOWN_SHELL_CLASS =
  'overflow-hidden rounded-lg border-2 border-gray-300 bg-white transition-colors duration-150 ease-out dark:border-gray-600 dark:bg-gray-800';

export const UI_TENANT_DROPDOWN_TRIGGER_CLASS =
  'flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 px-2 py-1.5 text-left transition-colors duration-150 ease-out';

/** Peer toggle knob — only animates transform, not every property. */
export const UI_TOGGLE_KNOB_AFTER_CLASS =
  'after:transition-transform after:duration-150 after:ease-out';

export function settingsChoiceNgClass(selected: boolean): Record<string, boolean> {
  return {
    [SETTINGS_CHOICE_SELECTED_CLASS]: selected,
    [SETTINGS_CHOICE_UNSELECTED_CLASS]: !selected,
  };
}

export function settingsChoiceSegmentNgClass(selected: boolean): Record<string, boolean> {
  return {
    'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-gray-800 dark:text-gray-100':
      selected,
    'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20':
      !selected,
  };
}
