import { describe, expect, it, vi } from 'vitest';
import {
  addPrayerItemReminderFromModal,
  removePrayerItemReminderFromModal,
} from './prayer-item-reminder-modal-submit';

describe('prayer-item-reminder-modal-submit', () => {
  const remindersService = {
    addReminder: vi.fn().mockResolvedValue([{ id: 'r1' }]),
    removeReminder: vi.fn().mockResolvedValue([]),
  };

  it('addPrayerItemReminderFromModal validates time and calls service', async () => {
    await expect(
      addPrayerItemReminderFromModal(
        remindersService as never,
        {
          email: ' u@x.com ',
          prayerId: 'p1',
          prayerKind: 'community',
          prayerFor: 'Sam',
          titleSnapshot: '',
        },
        {
          mode: 'once',
          localDate: '2026-01-01',
          localWeekday: 0,
          selectedTimeValue: 'bad',
        }
      )
    ).rejects.toThrow('Choose a valid reminder time.');

    const result = await addPrayerItemReminderFromModal(
      remindersService as never,
      {
        email: 'u@x.com',
        prayerId: 'p1',
        prayerKind: 'community',
        prayerFor: 'Sam',
        titleSnapshot: 'Title',
      },
      {
        mode: 'weekly',
        localDate: '',
        localWeekday: 3,
        selectedTimeValue: '9:0',
      }
    );
    expect(result).toHaveLength(1);
    expect(remindersService.addReminder).toHaveBeenCalledWith(
      'u@x.com',
      expect.objectContaining({
        local_hour: 9,
        local_minute: 0,
        local_weekday: 3,
        local_date: null,
        title_snapshot: 'Title',
      })
    );
  });

  it('removePrayerItemReminderFromModal trims email', async () => {
    await removePrayerItemReminderFromModal(
      remindersService as never,
      ' a@b.com ',
      'rid'
    );
    expect(remindersService.removeReminder).toHaveBeenCalledWith('a@b.com', 'rid');
  });
});
