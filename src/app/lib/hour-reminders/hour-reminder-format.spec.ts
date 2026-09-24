import { describe, expect, it } from 'vitest';
import {
  buildReminderHourOptions,
  buildReminderTimeOptions,
  deviceIanaTimezone,
  formatHour12,
  formatHourReminderSlotLabel,
  formatTime12,
  nextReminderQuarterSlot,
  parseReminderTimeOptionValue,
  reminderTimeOptionValue,
} from './hour-reminder-format';

describe('hour-reminder-format', () => {
  it('formatTime12 and formatHour12 produce readable labels', () => {
    expect(formatTime12(9, 0)).toMatch(/9/);
    expect(formatHour12(9)).toMatch(/9/);
  });

  it('reminderTimeOptionValue round-trips via parse', () => {
    const value = reminderTimeOptionValue(8, 30);
    expect(parseReminderTimeOptionValue(value)).toEqual({ hour: 8, minute: 30 });
    expect(parseReminderTimeOptionValue('bad')).toBeNull();
  });

  it('buildReminderTimeOptions includes quarter hours', () => {
    const options = buildReminderTimeOptions();
    expect(options.length).toBe(96);
    expect(options[0]?.value).toBe('0:0');
  });

  it('nextReminderQuarterSlot advances to next quarter hour', () => {
    const from = new Date(2026, 0, 1, 9, 10, 0);
    const next = nextReminderQuarterSlot(from);
    expect(next).toEqual({ hour: 9, minute: 15, value: '9:15' });
  });

  it('buildReminderHourOptions lists 24 hours', () => {
    expect(buildReminderHourOptions()).toHaveLength(24);
  });

  it('formatHourReminderSlotLabel omits zone when local', () => {
    const tz = deviceIanaTimezone();
    expect(
      formatHourReminderSlotLabel({
        local_hour: 8,
        local_minute: 0,
        iana_timezone: tz,
      } as never)
    ).toMatch(/8/);
    expect(
      formatHourReminderSlotLabel({
        local_hour: 8,
        local_minute: 0,
        iana_timezone: 'America/New_York',
      } as never)
    ).toContain('America/New_York');
  });
});
