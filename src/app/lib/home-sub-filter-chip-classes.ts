/** Folder-tab chrome shared by Home and the Info filter mock (label typography included).
 *  16px is fixed so Settings text size does not scale these labels (root rem does). */
export const HOME_FILTER_TAB_BASE_CLASS =
  "flex-1 min-w-0 px-3 py-2 text-center text-[16px] font-semibold leading-tight text-gray-700 dark:text-gray-300 transition-colors duration-150 ease-out cursor-pointer relative flex flex-col items-center justify-center";

/** Slightly tinted off-white for inactive tabs/chips (not pure white on cream canvas). */
export const HOME_INACTIVE_SURFACE_BG_CLASS =
  "bg-church-surface-inactive dark:bg-gray-800";

export const HOME_INACTIVE_SURFACE_HOVER_BG_CLASS =
  "hover:bg-church-surface-inactive-hover dark:hover:bg-gray-700";

/** Slightly darker than gray-300 so borders read on tinted inactive fills. */
export const HOME_INACTIVE_SURFACE_BORDER_CLASS =
  "border border-church-surface-inactive-border dark:border-gray-600";

export const HOME_FILTER_TAB_INACTIVE_BORDER_CLASS =
  "border border-church-surface-inactive-tab-border dark:border-gray-700";

export const HOME_FILTER_TAB_INACTIVE_CLASS = [
  HOME_INACTIVE_SURFACE_BG_CLASS,
  HOME_FILTER_TAB_INACTIVE_BORDER_CLASS,
  HOME_INACTIVE_SURFACE_HOVER_BG_CLASS,
].join(" ");

/** Church green medium edge on Home shell chrome (header bottom / native footer top). */
export const HOME_SHELL_CHROME_BORDER_COLOR_CLASS =
  "border-[#2F5F54] dark:border-[#2F5F54]";

export const HOME_SHELL_HEADER_BORDER_BOTTOM_CLASS = `border-b ${HOME_SHELL_CHROME_BORDER_COLOR_CLASS}`;

export const HOME_SHELL_FOOTER_BORDER_TOP_CLASS = `border-t ${HOME_SHELL_CHROME_BORDER_COLOR_CLASS}`;

/** Shared CSS class for modal panel outer edge (see `.modal-panel-edge` in styles.css). */
export const MODAL_PANEL_EDGE_CLASS = "modal-panel-edge";

/** 1px church green edge on memorize cards, home search, and similar shells. */
export const CHURCH_GREEN_SHELL_BORDER_CLASS =
  "border border-church-surface-inactive-tab-border dark:border-[#2F5F54]";

/** @deprecated Use {@link CHURCH_GREEN_SHELL_BORDER_CLASS}. */
export const MEMORIZE_CARD_SHELL_BORDER_CLASS = CHURCH_GREEN_SHELL_BORDER_CLASS;

/** Modal / settings dialog header and footer edges (same church green medium). */
export const MODAL_CHROME_BORDER_BOTTOM_CLASS = HOME_SHELL_HEADER_BORDER_BOTTOM_CLASS;
export const MODAL_CHROME_BORDER_TOP_CLASS = HOME_SHELL_FOOTER_BORDER_TOP_CLASS;

export type HomeFilterTabAccent =
  | "public"
  | "personal"
  | "prompts"
  | "memorize"
  | "members"
  | "groups";

/** Light-mode Personal tab/panel fill — church sage (`church-green-tint` in styles.css). */
export const HOME_PERSONAL_FILL_LIGHT_CLASS =
  "bg-church-green-tint dark:bg-green-900/40";

/**
 * Fill + accent color only. Width is applied in {@link homeFilterTabClass}:
 * `border-[2px]` on a connected tab overrides `border-b-0` in the generated CSS.
 */
export const HOME_FILTER_TAB_ACTIVE_FILL = {
  public: "bg-blue-200 dark:bg-blue-950 border-[#0047AB] dark:border-[#0047AB]",
  personal:
    `${HOME_PERSONAL_FILL_LIGHT_CLASS} border-[#2F5F54] dark:border-[#2F5F54]`,
  prompts:
    "bg-stone-300 dark:bg-stone-900/40 border-[#988F83] dark:border-[#988F83]",
  memorize: "bg-blue-200 dark:bg-blue-950 border-[#0047AB] dark:border-[#0047AB]",
  members:
    "bg-slate-200 dark:bg-blue-900/40 border-[#0047AB] dark:border-[#0047AB]",
  groups:
    "bg-slate-200 dark:bg-blue-900/40 border-[#0047AB] dark:border-[#0047AB]",
} as const;

/** Top + sides only so the tab joins the folder panel (no bottom stroke). */
export const HOME_FILTER_TAB_CONNECTED_BORDER_CLASS =
  "border-t-[2px] border-x-[2px] border-b-0 z-10";

export function homeFilterTabClass(options: {
  accent: HomeFilterTabAccent;
  active: boolean;
  hasSubRow: boolean;
}): string {
  const { accent, active, hasSubRow } = options;
  const shape = hasSubRow ? "rounded-t-lg" : "rounded-lg";
  if (!active) {
    return `${HOME_FILTER_TAB_BASE_CLASS} ${shape} ${HOME_FILTER_TAB_INACTIVE_CLASS}`;
  }
  const fill = HOME_FILTER_TAB_ACTIVE_FILL[accent];
  const border = hasSubRow
    ? HOME_FILTER_TAB_CONNECTED_BORDER_CLASS
    : "border-[2px]";
  return `${HOME_FILTER_TAB_BASE_CLASS} ${shape} ${fill} ${border}`;
}

/** Color plus the hover lift shadow. */
const HOME_SUB_FILTER_CHIP_MOTION_CLASS =
  "transition-[color,background-color,border-color,box-shadow] duration-150 ease-out";

/** Shared sizing for Home secondary filter chips (Public status, Personal, Prompt types). */
export const HOME_SUB_FILTER_CHIP_SIZE_CLASS =
  "min-h-9 px-3 py-2 rounded-lg text-xs font-medium tabular-nums";

/** Square add chip — large plus icon instead of “Add” label. */
export const HOME_SUB_FILTER_ADD_CHIP_LAYOUT_CLASS = [
  "inline-flex items-center justify-center ui-motion-interactive ui-press",
  "min-h-9 min-w-9 px-0 py-0 rounded-lg text-xs font-medium shrink-0",
].join(" ");

/** Resting ghost chip: translucent until hover lifts it into the tab accent. */
const HOME_SUB_FILTER_ADD_CHIP_GHOST_REST_CLASS = [
  "border border-church-surface-inactive-border/70 dark:border-gray-600/80 shadow-none",
  "bg-church-surface-inactive/40 dark:bg-gray-800/45",
  "text-gray-800 dark:text-gray-200",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800",
].join(" ");

/** Hover previews the selected fill and lifts; the ring stays on the selected chip. */
const HOME_SUB_FILTER_HOVER_BLUE_CLASS = [
  "hover:border-[#0047AB] dark:hover:border-[#0047AB]",
  "hover:bg-home-panel-blue-chip-active dark:hover:!bg-home-panel-blue-chip-active-dark",
  "hover:shadow-[0_6px_16px_-6px_rgb(0_71_171/0.55)]",
  "focus-visible:border-[#0047AB] dark:focus-visible:border-[#0047AB]",
  "focus-visible:bg-home-panel-blue-chip-active dark:focus-visible:!bg-home-panel-blue-chip-active-dark",
].join(" ");

const HOME_SUB_FILTER_HOVER_GREEN_CLASS = [
  "hover:border-[#2F5F54] dark:hover:border-[#2F5F54]",
  "hover:bg-home-panel-personal-chip-active dark:hover:!bg-home-panel-personal-chip-active-dark",
  "hover:shadow-[0_6px_16px_-6px_rgb(47_95_84/0.5)]",
  "focus-visible:border-[#2F5F54] dark:focus-visible:border-[#2F5F54]",
  "focus-visible:bg-home-panel-personal-chip-active dark:focus-visible:!bg-home-panel-personal-chip-active-dark",
].join(" ");

/** Public + Groups filter rows (church blue accent). */
export const HOME_SUB_FILTER_ADD_CHIP_GHOST_INACTIVE_BLUE_CLASS = [
  HOME_SUB_FILTER_ADD_CHIP_GHOST_REST_CLASS,
  HOME_SUB_FILTER_HOVER_BLUE_CLASS,
].join(" ");

/** Personal category filter row (sage accent). */
export const HOME_SUB_FILTER_ADD_CHIP_GHOST_INACTIVE_GREEN_CLASS = [
  HOME_SUB_FILTER_ADD_CHIP_GHOST_REST_CLASS,
  HOME_SUB_FILTER_HOVER_GREEN_CLASS,
].join(" ");

/** Button styles for equal-width chips; host uses flex-1 via HomeSubFilterChipComponent.stretch. */
export const HOME_SUB_FILTER_CHIP_BASE_CLASS = [
  "whitespace-nowrap inline-flex items-center justify-center",
  HOME_SUB_FILTER_CHIP_MOTION_CLASS,
  HOME_SUB_FILTER_CHIP_SIZE_CLASS,
].join(" ");

/** Content-sized chip for wrapping sub-filter rows (e.g. prompt types). */
export const HOME_SUB_FILTER_CHIP_WRAP_CLASS = [
  "inline-flex items-center justify-center whitespace-nowrap",
  HOME_SUB_FILTER_CHIP_MOTION_CLASS,
  HOME_SUB_FILTER_CHIP_SIZE_CLASS,
].join(" ");

/** Full-width chip button inside a shared wrap row (no drag handle). */
export const HOME_SUB_FILTER_CHIP_WRAP_STRETCH_CLASS = [
  "relative flex min-h-9 w-full min-w-max items-center justify-center gap-1 text-center",
  HOME_SUB_FILTER_CHIP_MOTION_CLASS,
  HOME_SUB_FILTER_CHIP_SIZE_CLASS,
  "whitespace-nowrap",
].join(" ");

/** Content-sized chip with left padding for a drag handle (personal categories). */
export const HOME_SUB_FILTER_CHIP_DRAG_WRAP_CLASS = [
  "relative inline-flex items-center justify-center whitespace-nowrap pl-7 pr-3",
  HOME_SUB_FILTER_CHIP_MOTION_CLASS,
  "min-h-9 py-2 rounded-lg text-xs font-medium",
].join(" ");

/** Flex item: equal split up to 2/row (3 on sm+); grows to fit label or full row when needed. */
export const HOME_WRAP_FILTER_CHIP_FLEX_CLASS = [
  "relative flex min-w-max flex-[1_1_0]",
  "max-w-[min(100%,max(calc((100%-0.5rem)/2),max-content))]",
  "sm:max-w-[min(100%,max(calc((100%-1rem)/3),max-content))]",
].join(" ");

/**
 * Host for Public status chips: share remaining row width equally, wrap only
 * when labels cannot fit (`min-w-max`). No 2-per-row cap so Current / Answered /
 * Archived can stay on one row.
 */
export const HOME_PUBLIC_STATUS_CHIP_HOST_CLASS =
  "relative flex min-w-max flex-[1_1_0]";

/** Wrapping chip row for Public status filters. */
export const HOME_PUBLIC_STATUS_CHIP_ROW_CLASS =
  "flex w-full flex-wrap items-stretch gap-2";

/** Solo-row flex item: full row width, no min-w-max (avoids conflicting with truncation). */
export const HOME_WRAP_FILTER_CHIP_SOLO_FLEX_CLASS =
  "relative flex min-w-0 w-full max-w-full flex-[1_1_0]";

/** @deprecated Use {@link HOME_WRAP_FILTER_CHIP_FLEX_CLASS}. */
export const HOME_PERSONAL_CATEGORY_CHIP_FLEX_CLASS =
  HOME_WRAP_FILTER_CHIP_FLEX_CLASS;

/** @deprecated Use {@link HOME_WRAP_FILTER_CHIP_SOLO_FLEX_CLASS}. */
export const HOME_PERSONAL_CATEGORY_CHIP_SOLO_FLEX_CLASS =
  HOME_WRAP_FILTER_CHIP_SOLO_FLEX_CLASS;

/** Chip shell with left padding for a drag handle and room for the overflow menu. */
export const HOME_SUB_FILTER_CHIP_DRAG_STRETCH_CLASS = [
  "relative flex min-h-9 w-full min-w-max items-center gap-0.5 text-center pl-7 pr-0.5",
  HOME_SUB_FILTER_CHIP_MOTION_CLASS,
  "py-2 rounded-lg text-xs font-medium whitespace-nowrap",
].join(" ");

/** Full-width solo-row chip button; label may truncate when constrained. */
export const HOME_SUB_FILTER_CHIP_DRAG_SOLO_STRETCH_CLASS = [
  "relative flex w-full min-w-0 items-center gap-1 overflow-hidden text-center pl-7 pr-3",
  HOME_SUB_FILTER_CHIP_MOTION_CLASS,
  "min-h-9 py-2 rounded-lg text-xs font-medium whitespace-nowrap",
].join(" ");

/** Chip row inside a folder-tab panel. */
export const HOME_SUB_FILTER_CHIP_ROW_CLASS =
  "flex w-full flex-wrap items-stretch gap-2";

export const HOME_SUB_FILTER_CHIP_INACTIVE_CLASS = [
  HOME_INACTIVE_SURFACE_BG_CLASS,
  "text-gray-700 dark:text-gray-300",
  HOME_INACTIVE_SURFACE_BORDER_CLASS,
].join(" ");

/** Selected chip fills — lighter than matching folder panel background. */
export const HOME_PUBLIC_PANEL_CHIP_ACTIVE_FILL_CLASS =
  "bg-home-panel-blue-chip-active dark:bg-home-panel-blue-chip-active-dark";

export const HOME_PERSONAL_PANEL_CHIP_ACTIVE_FILL_CLASS =
  "bg-home-panel-personal-chip-active dark:bg-home-panel-personal-chip-active-dark";

export const HOME_PROMPTS_PANEL_CHIP_ACTIVE_FILL_CLASS =
  "bg-home-panel-stone-chip-active dark:bg-home-panel-stone-chip-active-dark";

/** Church blue chip styles (public status row, prompt-type row under Church, etc.). */
export const HOME_CHURCH_BLUE_CHIP_ACTIVE_CLASS =
  `border !border-[#0047AB] dark:!border-[#0047AB] ${HOME_PUBLIC_PANEL_CHIP_ACTIVE_FILL_CLASS} ring ring-[#0047AB] dark:ring-[#0047AB] ring-offset-0 text-gray-700 dark:text-gray-300 shadow-md`;

/** Unselected Church, Groups, and Prompts chips — same ghost rest and hover as Add. */
export const HOME_CHURCH_BLUE_CHIP_INACTIVE_CLASS =
  HOME_SUB_FILTER_ADD_CHIP_GHOST_INACTIVE_BLUE_CLASS;

/** Church tab sub-filters share the same blue accent as Current. */
const HOME_PUBLIC_STATUS_CHIP_BLUE_THEME = {
  active: HOME_CHURCH_BLUE_CHIP_ACTIVE_CLASS,
  inactive: HOME_CHURCH_BLUE_CHIP_INACTIVE_CLASS,
} as const;

/** Tailwind active/inactive pairs for public community sub-chips. */
export const HOME_PUBLIC_STATUS_CHIP_THEMES = {
  current: HOME_PUBLIC_STATUS_CHIP_BLUE_THEME,
  answered: HOME_PUBLIC_STATUS_CHIP_BLUE_THEME,
  archived: HOME_PUBLIC_STATUS_CHIP_BLUE_THEME,
  total: HOME_PUBLIC_STATUS_CHIP_BLUE_THEME,
  prompts: HOME_PUBLIC_STATUS_CHIP_BLUE_THEME,
  members: HOME_PUBLIC_STATUS_CHIP_BLUE_THEME,
} as const;

/** Unselected personal category chips — same ghost rest and hover as Add. */
export const HOME_PERSONAL_NAMED_CHIP_INACTIVE_CLASS =
  HOME_SUB_FILTER_ADD_CHIP_GHOST_INACTIVE_GREEN_CLASS;

/** Personal sub-filters: selected chip (matches Personal tab accent). */
export const HOME_PERSONAL_SUB_FILTER_CHIP_ACTIVE_CLASS =
  `border !border-[#2F5F54] dark:!border-[#2F5F54] ${HOME_PERSONAL_PANEL_CHIP_ACTIVE_FILL_CLASS} ring ring-[#2F5F54] dark:ring-[#2F5F54] ring-offset-0 text-gray-700 dark:text-gray-300 shadow-md`;

/** Tab accent hex values (documented; panel fills use full literals below for Tailwind). */
export const HOME_FILTER_TAB_BORDER = {
  public: "#0047AB",
  personal: "#2F5F54",
  prompts: "#988F83",
  memorize: "#0047AB",
  groups: "#0047AB",
} as const;

/** Folder-tab body: fill + side/bottom accent; no top border so it joins the selected tab. */
export const HOME_PUBLIC_SUB_FILTER_GROUP_CLASS =
  "rounded-b-lg bg-blue-200 dark:bg-blue-950 border-x-[2px] border-b-[2px] border-t-0 border-[#0047AB] dark:border-[#0047AB] px-3 py-2";
export const HOME_PERSONAL_SUB_FILTER_GROUP_CLASS =
  `rounded-b-lg ${HOME_PERSONAL_FILL_LIGHT_CLASS} border-x-[2px] border-b-[2px] border-t-0 border-[#2F5F54] dark:border-[#2F5F54] px-3 py-2`;
/** Prompt type row under Church uses the same blue panel as public status filters. */
export const HOME_PROMPTS_SUB_FILTER_GROUP_CLASS =
  HOME_PUBLIC_SUB_FILTER_GROUP_CLASS;
/** Same blue fill as Public — Memorize tab shares `#0047AB`. */
export const HOME_MEMORIZE_SUB_FILTER_GROUP_CLASS =
  HOME_PUBLIC_SUB_FILTER_GROUP_CLASS;
/** Same slate fill as the Groups tab (`HOME_FILTER_TAB_ACTIVE_FILL.groups`). */
export const HOME_GROUPS_SUB_FILTER_GROUP_CLASS =
  "rounded-b-lg bg-slate-200 dark:bg-blue-900/40 border-x-[2px] border-b-[2px] border-t-0 border-[#0047AB] dark:border-[#0047AB] px-3 py-2";
