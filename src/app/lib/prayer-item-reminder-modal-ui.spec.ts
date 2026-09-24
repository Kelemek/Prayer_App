import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildPrayerItemReminderDateOptions,
  buildPrayerItemReminderDropdownPanelStyle,
  formatPrayerItemReminderLine,
  formatPrayerItemReminderLocalDate,
  isPrayerItemReminderOnceInPast,
  prayerItemReminderAddErrorMessage,
  prayerItemReminderDateLabel,
  prayerItemReminderDropdownShellClass,
  prayerItemReminderRemoveErrorMessage,
  prayerItemReminderTimeLabel,
  prayerItemReminderWeekdayLabel,
  refreshPrayerItemReminderLocalDate,
  shouldClosePrayerItemReminderDropdownOnPointerDown,
  todayPrayerItemReminderLocalDateString,
  validatePrayerItemReminderAddInput,
} from './prayer-item-reminder-modal-ui';
import type { PrayerItemReminder } from '../types/prayer-item-reminder';

describe('prayerItemReminderDropdownShellClass', () => {
  it('uses active border classes when open', () => {
    expect(prayerItemReminderDropdownShellClass(true)).toContain('border-blue-500');
  });
});

describe('shouldClosePrayerItemReminderDropdownOnPointerDown', () => {
  it('closes when pointer down is outside the modal host', () => {
    const host = document.createElement('div');
    const outside = document.createElement('button');
    document.body.appendChild(host);
    document.body.appendChild(outside);

    expect(
      shouldClosePrayerItemReminderDropdownOnPointerDown(outside, host)
    ).toBe(true);

    host.remove();
    outside.remove();
  });

  it('does not close when pointer down is on a dropdown trigger', () => {
    const host = document.createElement('div');
    const trigger = document.createElement('button');
    trigger.setAttribute('aria-haspopup', 'listbox');
    host.appendChild(trigger);
    document.body.appendChild(host);

    expect(
      shouldClosePrayerItemReminderDropdownOnPointerDown(trigger, host)
    ).toBe(false);

    host.remove();
  });

  it('closes when pointer down is on Add reminder inside the modal host', () => {
    const host = document.createElement('div');
    const addButton = document.createElement('button');
    addButton.textContent = 'Add reminder';
    host.appendChild(addButton);
    document.body.appendChild(host);

    expect(
      shouldClosePrayerItemReminderDropdownOnPointerDown(addButton, host)
    ).toBe(true);

    host.remove();
  });
});

describe('buildPrayerItemReminderDateOptions', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('labels first two options Today and Tomorrow', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T12:00:00'));

    const options = buildPrayerItemReminderDateOptions(3);
    expect(options[0].label).toMatch(/^Today ·/);
    expect(options[1].label).toMatch(/^Tomorrow ·/);
    expect(options[0].value).toBe('2026-08-18');
  });
});

describe('formatPrayerItemReminderLine', () => {
  it('formats daily reminders', () => {
    const line = formatPrayerItemReminderLine(
      {
        id: '1',
        mode: 'daily',
        local_hour: 9,
        local_minute: 0,
      } as PrayerItemReminder,
      []
    );
    expect(line).toMatch(/^Daily ·/);
  });
});

describe('validatePrayerItemReminderAddInput', () => {
  it('rejects past once reminders', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T15:00:00'));
    const err = validatePrayerItemReminderAddInput('once', '2026-08-18', '9:00');
    expect(err).toBe('That date and time is already in the past.');
    vi.useRealTimers();
  });

  it('accepts future once reminders', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T08:00:00'));
    const err = validatePrayerItemReminderAddInput('once', '2026-08-18', '9:00');
    expect(err).toBeNull();
    vi.useRealTimers();
  });
});

describe('isPrayerItemReminderOnceInPast', () => {
  it('returns true for invalid date parts', () => {
    expect(isPrayerItemReminderOnceInPast('bad-date', 9, 0)).toBe(true);
  });
});

describe('prayerItemReminderAddErrorMessage', () => {
  it('maps duplicate schedule errors', () => {
    expect(prayerItemReminderAddErrorMessage({ code: '23505' })).toBe(
      'You already have a reminder for that schedule.'
    );
  });

  it('falls back to message or generic text', () => {
    expect(prayerItemReminderAddErrorMessage({ message: 'nope' })).toBe('nope');
    expect(prayerItemReminderAddErrorMessage(null)).toBe('Could not save reminder.');
  });
});

describe('prayerItemReminderRemoveErrorMessage', () => {
  it('uses message when present', () => {
    expect(prayerItemReminderRemoveErrorMessage({ message: 'gone' })).toBe('gone');
    expect(prayerItemReminderRemoveErrorMessage({})).toBe('Could not remove reminder.');
  });
});

describe('formatPrayerItemReminderLine modes', () => {
  it('formats once and weekly reminders', () => {
    const options = [{ value: '2026-08-20', label: 'Wed, Aug 20' }];
    expect(
      formatPrayerItemReminderLine(
        {
          id: '1',
          mode: 'once',
          local_date: '2026-08-20',
          local_hour: 8,
          local_minute: 30,
        } as PrayerItemReminder,
        options
      )
    ).toContain('Once · Wed, Aug 20');

    expect(
      formatPrayerItemReminderLine(
        {
          id: '2',
          mode: 'weekly',
          local_weekday: 1,
          local_hour: 7,
          local_minute: 0,
        } as PrayerItemReminder,
        []
      )
    ).toContain('Weekly · Monday');
  });
});

describe('reminder date helpers', () => {
  it('formats and refreshes local dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T12:00:00'));
    const today = todayPrayerItemReminderLocalDateString();
    expect(formatPrayerItemReminderLocalDate(new Date(2026, 7, 18))).toBe(today);
    const options = buildPrayerItemReminderDateOptions(2);
    expect(refreshPrayerItemReminderLocalDate(options, 'bad')).toBe(today);
    expect(prayerItemReminderDateLabel(options, options[1].value)).toContain('Tomorrow');
    vi.useRealTimers();
  });

  it('labels weekday and time selections', () => {
    expect(prayerItemReminderWeekdayLabel(3)).toBe('Wednesday');
    expect(prayerItemReminderTimeLabel('invalid')).toBe('Choose a time');
  });
});

describe('buildPrayerItemReminderDropdownPanelStyle', () => {
  it('positions below the trigger when there is room', () => {
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 130,
        left: 40,
        width: 200,
        right: 240,
        height: 30,
        x: 40,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    const style = buildPrayerItemReminderDropdownPanelStyle(trigger);
    expect(style.top).toBe('134px');
    expect(style.width).toBe('200px');
  });
});

describe('shouldClosePrayerItemReminderDropdownOnPointerDown edge cases', () => {
  it('returns true for null targets and keeps listbox clicks open', () => {
    const host = document.createElement('div');
    expect(shouldClosePrayerItemReminderDropdownOnPointerDown(null, host)).toBe(true);

    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    host.appendChild(listbox);
    document.body.appendChild(host);
    expect(shouldClosePrayerItemReminderDropdownOnPointerDown(listbox, host)).toBe(
      false
    );
    host.remove();
  });
});

describe('validatePrayerItemReminderAddInput', () => {
  it('requires valid time and once date', () => {
    expect(validatePrayerItemReminderAddInput('daily', '', 'bad')).toBe(
      'Choose a valid reminder time.'
    );
    expect(validatePrayerItemReminderAddInput('once', '', '9:00')).toBe(
      'Choose a date for a one-time reminder.'
    );
  });
});
