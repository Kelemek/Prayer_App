/** Foreground receipt revalidation interval when a local mirror is already warm. */
export const BADGE_FOREGROUND_RECEIPT_REVALIDATE_MS = 60_000;

/** Bound per-id badge subjects so a long session cannot grow the map forever. */
export const INDIVIDUAL_BADGE_SUBJECT_CAP = 200;
