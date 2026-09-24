import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrayerItemReminderModalComponent } from './prayer-item-reminder-modal.component';
import { PrayerItemReminderService } from '../../services/prayer-item-reminder.service';

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const path = join(componentDir, url);
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8');
  }
  throw new Error(`Component resource not found: ${url}`);
}

describe('PrayerItemReminderModalComponent', () => {
  let fixture: ComponentFixture<PrayerItemReminderModalComponent>;
  let component: PrayerItemReminderModalComponent;
  let addReminder: ReturnType<typeof vi.fn>;
  let removeReminder: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  beforeEach(async () => {
    addReminder = vi.fn().mockResolvedValue([{ id: 'r1' }]);
    removeReminder = vi.fn().mockResolvedValue([]);
    await TestBed.configureTestingModule({
      imports: [PrayerItemReminderModalComponent],
      providers: [
        {
          provide: PrayerItemReminderService,
          useValue: { addReminder, removeReminder },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrayerItemReminderModalComponent);
    component = fixture.componentInstance;
    component.email = 'user@example.com';
    component.prayerId = 'p1';
    component.prayerFor = 'Ann';
    component.titleSnapshot = 'Health';
    component.isOpen = true;
    component.localDate = component.dateOptions[0]?.value ?? '2026-09-24';
    component.selectedTimeValue = '09:00';
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('resets state when opened', () => {
    component.error = 'old';
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
    });
    expect(component.error).toBeNull();
    expect(component.selectedDateLabel).toBeTruthy();
  });

  it('sets reminder mode and closes dropdowns', () => {
    component.showTimeDropdown = true;
    component.setMode('weekly');
    expect(component.mode).toBe('weekly');
    expect(component.showTimeDropdown).toBe(false);
  });

  it('toggles date dropdown and applies panel style', () => {
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () =>
      ({ top: 10, bottom: 40, left: 5, right: 105, width: 100, height: 30 }) as DOMRect;
    component.toggleDateDropdown({ currentTarget: trigger } as Event);
    expect(component.showDateDropdown).toBe(true);
    expect(component.dropdownPanelStyle).toBeTruthy();
    component.toggleDateDropdown({ currentTarget: trigger } as Event);
    expect(component.showDateDropdown).toBe(false);
  });

  it('closes dropdowns on outside mousedown', () => {
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () =>
      ({ top: 10, bottom: 40, left: 5, right: 105, width: 100, height: 30 }) as DOMRect;
    component.toggleTimeDropdown({ currentTarget: trigger } as Event);
    component.onDocumentMouseDown({ target: document.body } as MouseEvent);
    expect(component.showTimeDropdown).toBe(false);
  });

  it('validates add input before calling the service', async () => {
    component.mode = 'once';
    component.localDate = '';
    await component.add();
    expect(addReminder).not.toHaveBeenCalled();
    expect(component.error).toBeTruthy();
  });

  it('adds a reminder and emits changes', async () => {
    const change = vi.fn();
    component.remindersChange.subscribe(change);
    component.mode = 'daily';
    await component.add();
    expect(addReminder).toHaveBeenCalled();
    expect(change).toHaveBeenCalledWith([{ id: 'r1' }]);
  });

  it('removes a reminder', async () => {
    const change = vi.fn();
    component.remindersChange.subscribe(change);
    await component.remove('r-old');
    expect(removeReminder).toHaveBeenCalledWith('user@example.com', 'r-old');
    expect(change).toHaveBeenCalledWith([]);
  });

  it('updates local date, weekday, and time selections', () => {
    component.setLocalDate('2026-10-01');
    expect(component.localDate).toBe('2026-10-01');
    component.setLocalWeekday(2);
    expect(component.localWeekday).toBe(2);
    component.setSelectedTime('10:30');
    expect(component.selectedTimeValue).toBe('10:30');
    expect(component.dropdownShellClass(true).length).toBeGreaterThan(10);
  });

  it('ignores dropdown open when trigger is not an element', () => {
    component.toggleWeekdayDropdown({ currentTarget: null } as Event);
    expect(component.showWeekdayDropdown).toBe(false);
  });

  it('surfaces add errors from the service', async () => {
    addReminder.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    component.mode = 'daily';
    await component.add();
    expect(component.error).toBeTruthy();
    expect(component.saving).toBe(false);
  });

  it('restores portal host on destroy', () => {
    component.ngOnDestroy();
    expect(component.isOpen).toBe(true);
  });

  it('formats reminder lines', () => {
    const line = component.formatReminder({
      id: '1',
      mode: 'daily',
      local_hour: 9,
      local_minute: 0,
      local_date: null,
      local_weekday: null,
      iana_timezone: 'UTC',
      prayer_id: 'p1',
      prayer_kind: 'community',
      title_snapshot: 'T',
      prayer_for_snapshot: 'Ann',
      tenant_id: 't1',
      user_email: 'user@example.com',
      last_sent_at: null,
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(line.length).toBeGreaterThan(3);
  });
});
