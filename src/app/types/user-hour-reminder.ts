/** One saved hourly reminder slot (local wall clock in an IANA timezone). */
export interface UserHourReminderSlot {
  id: string;
  iana_timezone: string;
  local_hour: number;
  local_minute?: number;
}

export type UserHourReminderKind = 'prayer' | 'memorization';

export const REMINDER_QUARTER_MINUTES = [0, 15, 30, 45] as const;
export type ReminderQuarterMinute = typeof REMINDER_QUARTER_MINUTES[number];
