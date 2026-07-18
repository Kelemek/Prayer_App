import type { UserHourReminderSlot } from '../../types/user-hour-reminder';

export function formatHour12(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function buildReminderHourOptions(): { value: number; label: string }[] {
  return Array.from({ length: 24 }, (_, h) => ({
    value: h,
    label: formatHour12(h),
  }));
}

/** IANA zone from the device (used when saving new reminder hours). */
export function deviceIanaTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

export function formatHourReminderSlotLabel(slot: UserHourReminderSlot): string {
  const hour = formatHour12(slot.local_hour);
  if (slot.iana_timezone === deviceIanaTimezone()) {
    return hour;
  }
  return `${hour} · ${slot.iana_timezone}`;
}
