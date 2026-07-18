import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { HourReminderSettingsSectionComponent } from './hour-reminder-settings-section.component';
import { UserHourReminderService } from '../../services/user-hour-reminder.service';
import { UserSessionService } from '../../services/user-session.service';
import {
  deviceIanaTimezone,
  formatHourReminderSlotLabel,
} from '../../lib/hour-reminders/hour-reminder-format';

describe('HourReminderSettingsSectionComponent', () => {
  let component: HourReminderSettingsSectionComponent;
  let mockReminders: {
    ensureLoaded: ReturnType<typeof vi.fn>;
    addSlot: ReturnType<typeof vi.fn>;
    removeSlot: ReturnType<typeof vi.fn>;
    sessionCacheKeys: ReturnType<typeof vi.fn>;
  };
  let mockUserSession: { getCurrentSession: ReturnType<typeof vi.fn> };
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockReminders = {
      ensureLoaded: vi.fn(() => Promise.resolve([])),
      addSlot: vi.fn(() =>
        Promise.resolve([{ id: 'slot-1', local_hour: 8, iana_timezone: 'America/Chicago' }])
      ),
      removeSlot: vi.fn(() => Promise.resolve([])),
      sessionCacheKeys: vi.fn(() => ({
        slotsKey: 'prayerHourReminders',
        fetchedAtKey: 'prayerHourRemindersFetchedAt',
      })),
    };
    mockUserSession = {
      getCurrentSession: vi.fn(() => ({ email: 'test@example.com' })),
    };
    mockCdr = { markForCheck: vi.fn() };

    component = new HourReminderSettingsSectionComponent(
      mockReminders as unknown as UserHourReminderService,
      mockUserSession as unknown as UserSessionService,
      mockCdr as unknown as ChangeDetectorRef
    );
    component.kind = 'prayer';
    component.title = 'Prayer reminders';
    component.description = 'desc';
    component.email = 'test@example.com';
    component.isOpen = true;
  });

  it('formatSlotLabel omits timezone when it matches device', () => {
    const label = component.formatSlotLabel({
      id: 's1',
      local_hour: 9,
      iana_timezone: deviceIanaTimezone(),
    });
    expect(label).not.toContain('·');
    expect(formatHourReminderSlotLabel).toBeDefined();
  });

  it('addSlot saves slot and shows success', async () => {
    await component.addSlot();
    expect(component.slots).toHaveLength(1);
    expect(component.success).toContain('saved');
    expect(component.saving).toBe(false);
    expect(mockReminders.addSlot).toHaveBeenCalledWith(
      'prayer',
      'test@example.com',
      deviceIanaTimezone(),
      9
    );
  });

  it('addSlot handles duplicate hour error', async () => {
    mockReminders.addSlot.mockRejectedValue({ code: '23505' });
    await component.addSlot();
    expect(component.error).toContain('already have a reminder');
  });

  it('reload ignores stale session cache for another email', async () => {
    mockReminders.sessionCacheKeys.mockReturnValue({
      slotsKey: 'memorizationHourReminders',
      fetchedAtKey: 'memorizationHourRemindersFetchedAt',
    });
    component.kind = 'memorization';
    const otherSlots = [{ id: 'other', local_hour: 3, iana_timezone: 'UTC' }];
    mockUserSession.getCurrentSession.mockReturnValue({
      email: 'other@example.com',
      memorizationHourReminders: otherSlots,
    });
    component.email = 'test@example.com';
    component.slots = otherSlots;
    component.reload();
    expect(component.slots).toEqual([]);
    expect(component.loading).toBe(true);
    await vi.waitFor(() => {
      expect(component.loading).toBe(false);
    });
  });

  it('reload forces a fresh fetch from the service', async () => {
    component.reload();
    await vi.waitFor(() => {
      expect(component.loading).toBe(false);
    });
    expect(mockReminders.ensureLoaded).toHaveBeenCalledWith('prayer', true);
  });

  it('reload ignores ensureLoaded result when session email changed', async () => {
    const slots = [{ id: 'cached', local_hour: 6, iana_timezone: 'UTC' }];
    mockUserSession.getCurrentSession.mockReturnValue({
      email: 'test@example.com',
      prayerHourReminders: undefined,
    });
    mockReminders.ensureLoaded.mockImplementation(async () => {
      mockUserSession.getCurrentSession.mockReturnValue({ email: 'other@example.com' });
      return slots;
    });
    component.reload();
    await vi.waitFor(() => {
      expect(component.loading).toBe(false);
    });
    expect(component.slots).toEqual([]);
  });

  it('ngOnChanges reloads when opened or email changes while open', () => {
    const reloadSpy = vi.spyOn(component, 'reload').mockImplementation(() => undefined);
    component.ngOnChanges({
      isOpen: {
        currentValue: true,
        previousValue: false,
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    expect(reloadSpy).toHaveBeenCalled();
    reloadSpy.mockClear();
    component.isOpen = true;
    component.ngOnChanges({
      email: {
        currentValue: 'new@example.com',
        previousValue: 'test@example.com',
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('setSelectedHour updates hour and closes dropdown', () => {
    component.showHourDropdown = true;
    component.setSelectedHour(14);
    expect(component.selectedHour).toBe(14);
    expect(component.showHourDropdown).toBe(false);
    expect(mockCdr.markForCheck).toHaveBeenCalled();
  });

  it('reload clears slots when email is empty', () => {
    component.email = '   ';
    component.slots = [{ id: 'x', local_hour: 1, iana_timezone: 'UTC' }];
    component.reload();
    expect(component.slots).toEqual([]);
    expect(component.loading).toBe(false);
  });

  it('reload uses session cache when email matches', async () => {
    const cached = [{ id: 'cached', local_hour: 7, iana_timezone: 'UTC' }];
    mockUserSession.getCurrentSession.mockReturnValue({
      email: 'test@example.com',
      prayerHourReminders: cached,
    });
    mockReminders.ensureLoaded.mockResolvedValue(cached);
    component.reload();
    expect(component.slots).toEqual(cached);
    expect(component.loading).toBe(false);
    await vi.waitFor(() => expect(mockReminders.ensureLoaded).toHaveBeenCalled());
  });

  it('reload sets error on ensureLoaded failure', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockReminders.ensureLoaded.mockRejectedValue({ message: 'load boom' });
    component.reload();
    await vi.waitFor(() => {
      expect(component.error).toBe('load boom');
      expect(component.loading).toBe(false);
    });
    errSpy.mockRestore();
  });

  it('addSlot no-ops without email and handles generic errors', async () => {
    component.email = '';
    await component.addSlot();
    expect(mockReminders.addSlot).not.toHaveBeenCalled();

    component.email = 'test@example.com';
    mockReminders.addSlot.mockRejectedValue({ message: 'save failed' });
    await component.addSlot();
    expect(component.error).toBe('save failed');
  });

  it('removeSlot updates slots and handles errors', async () => {
    mockReminders.removeSlot.mockResolvedValue([]);
    await component.removeSlot('slot-1');
    expect(mockReminders.removeSlot).toHaveBeenCalledWith(
      'prayer',
      'test@example.com',
      'slot-1'
    );
    expect(component.slots).toEqual([]);
    expect(component.success).toContain('removed');

    component.email = '';
    await component.removeSlot('slot-1');
    expect(mockReminders.removeSlot).toHaveBeenCalledTimes(1);

    component.email = 'test@example.com';
    mockReminders.removeSlot.mockRejectedValue({ message: 'remove failed' });
    await component.removeSlot('slot-1');
    expect(component.error).toBe('remove failed');

    mockReminders.removeSlot.mockRejectedValue('x');
    await component.removeSlot('slot-1');
    expect(component.error).toBe('Could not remove reminder.');
  });
});
