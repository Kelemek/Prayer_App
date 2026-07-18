/** One saved hourly reminder slot (local wall clock in an IANA timezone). */
export interface UserHourReminderSlot {
  id: string;
  iana_timezone: string;
  local_hour: number;
}

export type UserHourReminderKind = 'prayer' | 'memorization';
