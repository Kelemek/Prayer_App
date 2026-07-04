import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { EmailSettingsComponent } from './email-settings.component';

const MOCK_TENANT = {
  id: 'tenant-1',
  name: 'Test Org',
  slug: 'test-org',
  plan_tier: 'churches' as const,
  plan_status: 'active' as const
};

describe('EmailSettingsComponent', () => {
  let component: EmailSettingsComponent;
  let mockSupabaseService: any;
  let mockToastService: any;
  let mockChangeDetectorRef: any;
  let mockTenantContext: any;

  beforeEach(() => {
    mockTenantContext = {
      getActiveTenant: vi.fn(() => MOCK_TENANT),
      activeTenant$: new BehaviorSubject(MOCK_TENANT)
    };

    mockSupabaseService = {
      client: {
        auth: {
          getSession: vi.fn(() =>
            Promise.resolve({
              data: {
                session: {
                  access_token: 'test-jwt',
                  user: { email: 'admin@test.com' }
                }
              }
            })
          )
        },
        rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
            }))
          })),
          upsert: vi.fn(() => Promise.resolve({ error: null })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null }))
          }))
        }))
      }
    };

    mockToastService = {
      success: vi.fn(),
      error: vi.fn()
    };

    mockChangeDetectorRef = {
      detectChanges: vi.fn(),
      markForCheck: vi.fn()
    };

    component = new EmailSettingsComponent(
      mockSupabaseService,
      mockToastService,
      mockChangeDetectorRef as ChangeDetectorRef,
      mockTenantContext
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('default property values', () => {
    it('should have enableReminders default to false', () => {
      expect(component.enableReminders).toBe(false);
    });

    it('should have reminderIntervalDays default to 7', () => {
      expect(component.reminderIntervalDays).toBe(7);
    });

    it('should have enableAutoArchive default to false', () => {
      expect(component.enableAutoArchive).toBe(false);
    });

    it('should have daysBeforeArchive default to 7', () => {
      expect(component.daysBeforeArchive).toBe(7);
    });

    it('should have isLoading default to false', () => {
      expect(component.isLoading).toBe(false);
    });

    it('should have sectionExpanded default to false', () => {
      expect(component.sectionExpanded).toBe(false);
    });

    it('should have savingReminders default to false', () => {
      expect(component.savingReminders).toBe(false);
    });

    it('should have error default to null', () => {
      expect(component.error).toBe(null);
    });

    it('should have successVerification default to false', () => {
      expect(component.successVerification).toBe(false);
    });

    it('should have successReminders default to false', () => {
      expect(component.successReminders).toBe(false);
    });
  });

  describe('ngOnInit', () => {
    it('should not load settings until section is expanded', async () => {
      const loadSettingsSpy = vi.spyOn(component, 'loadSettings');
      component.ngOnInit();
      await Promise.resolve();
      expect(loadSettingsSpy).not.toHaveBeenCalled();
    });
  });

  describe('onExpandedChange', () => {
    it('should lazy-load settings on first expand', async () => {
      const loadSettingsSpy = vi.spyOn(component, 'loadSettings').mockResolvedValue(undefined);
      component.onExpandedChange(true);
      await vi.waitUntil(() => loadSettingsSpy.mock.calls.length > 0);
      expect(component.sectionExpanded).toBe(true);
      expect(loadSettingsSpy).toHaveBeenCalled();
    });

    it('should reload settings when expanding after tenant switch', async () => {
      const loadSettingsSpy = vi.spyOn(component, 'loadSettings').mockResolvedValue(undefined);
      component.onExpandedChange(true);
      await vi.waitUntil(() => loadSettingsSpy.mock.calls.length === 1);

      component.onExpandedChange(false);
      mockTenantContext.getActiveTenant.mockReturnValue({
        ...MOCK_TENANT,
        id: 'tenant-2',
      });
      (mockTenantContext.activeTenant$ as BehaviorSubject<typeof MOCK_TENANT>).next({
        ...MOCK_TENANT,
        id: 'tenant-2',
      });

      component.onExpandedChange(true);
      await vi.waitUntil(() => loadSettingsSpy.mock.calls.length === 2);
      expect(loadSettingsSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadSettings', () => {
    it('should set isLoading to true initially', async () => {
      component.isLoading = false;
      const promise = component.loadSettings();
      expect(component.isLoading).toBe(true);
      await promise;
    });

    it('should load settings successfully', async () => {
      const mockData = {
        enable_reminders: true,
        reminder_interval_days: 14,
        enable_auto_archive: true,
        days_before_archive: 10
      };
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({ data: [mockData], error: null })
      );

      await component.loadSettings();

      expect(component.enableReminders).toBe(true);
      expect(component.reminderIntervalDays).toBe(14);
      expect(component.enableAutoArchive).toBe(true);
      expect(component.daysBeforeArchive).toBe(10);
      expect(component.isLoading).toBe(false);
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should handle null data fields gracefully', async () => {
      const mockData = {
        enable_reminders: null,
        reminder_interval_days: null,
        enable_auto_archive: null,
        days_before_archive: null
      };
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({ data: [mockData], error: null })
      );

      const originalReminders = component.enableReminders;
      const originalInterval = component.reminderIntervalDays;

      await component.loadSettings();

      expect(component.enableReminders).toBe(originalReminders);
      expect(component.reminderIntervalDays).toBe(originalInterval);
      expect(component.isLoading).toBe(false);
    });

    it('should handle undefined data fields gracefully', async () => {
      const mockData = {
        enable_reminders: undefined,
        reminder_interval_days: undefined,
        enable_auto_archive: undefined,
        days_before_archive: undefined
      };
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({ data: [mockData], error: null })
      );

      const originalReminders = component.enableReminders;
      const originalInterval = component.reminderIntervalDays;

      await component.loadSettings();

      expect(component.enableReminders).toBe(originalReminders);
      expect(component.reminderIntervalDays).toBe(originalInterval);
      expect(component.isLoading).toBe(false);
    });

    it('should handle error when loading settings fails', async () => {
      const mockError = { message: 'Database error' };
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({ data: null, error: mockError })
      );

      await component.loadSettings();

      expect(component.error).toBe('Failed to load email settings: Database error');
      expect(component.isLoading).toBe(false);
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should handle error without message', async () => {
      const mockError = {};
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({ data: null, error: mockError })
      );

      await component.loadSettings();

      expect(component.error).toBe('Failed to load email settings: Unknown error');
      expect(component.isLoading).toBe(false);
    });

    it('should handle exception when loading settings', async () => {
      mockSupabaseService.client.rpc = vi.fn(() => {
        throw new Error('Network error');
      });

      await component.loadSettings();

      expect(component.error).toBe('Failed to load email settings: Network error');
      expect(component.isLoading).toBe(false);
    });
  });

  describe('saveReminderSettings', () => {
    it('should set savingReminders to true initially', async () => {
      component.savingReminders = false;
      const promise = component.saveReminderSettings();
      expect(component.savingReminders).toBe(true);
      await promise;
    });

    it('should save reminder settings successfully', async () => {
      const rpcMock = vi.fn(() => Promise.resolve({ error: null }));
      mockSupabaseService.client.rpc = rpcMock;
      vi.spyOn(component, 'loadSettings').mockResolvedValue(undefined);

      component.enableReminders = true;
      component.reminderIntervalDays = 10;
      component.enableAutoArchive = true;
      component.daysBeforeArchive = 5;

      const emitSpy = vi.spyOn(component.onSave, 'emit');

      await component.saveReminderSettings();

      expect(rpcMock).toHaveBeenCalledWith('update_tenant_reminder_settings', {
        p_tenant_id: MOCK_TENANT.id,
        p_enable_reminders: true,
        p_reminder_interval_days: 10,
        p_enable_auto_archive: true,
        p_days_before_archive: 5,
        p_email: 'admin@test.com'
      });
      expect(component.successReminders).toBe(true);
      expect(component.error).toBe(null);
      expect(component.savingReminders).toBe(false);
      expect(mockToastService.success).toHaveBeenCalledWith('Prayer reminder settings saved!');
      expect(emitSpy).toHaveBeenCalled();
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should clear success message after 3 seconds', async () => {
      vi.useFakeTimers();
      mockSupabaseService.client.rpc = vi.fn(() => Promise.resolve({ error: null }));
      vi.spyOn(component, 'loadSettings').mockResolvedValue(undefined);

      await component.saveReminderSettings();

      expect(component.successReminders).toBe(true);

      vi.advanceTimersByTime(3000);

      expect(component.successReminders).toBe(false);
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle error when saving fails', async () => {
      const mockError = { message: 'Update failed' };
      mockSupabaseService.client.rpc = vi.fn(() => Promise.resolve({ error: mockError }));

      await component.saveReminderSettings();

      expect(component.error).toBe('Failed to save reminder settings: Update failed');
      expect(component.successReminders).toBe(false);
      expect(component.savingReminders).toBe(false);
      expect(mockToastService.error).toHaveBeenCalledWith('Failed to save reminder settings');
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should handle error without message', async () => {
      const mockError = {};
      mockSupabaseService.client.rpc = vi.fn(() => Promise.resolve({ error: mockError }));

      await component.saveReminderSettings();

      expect(component.error).toBe('Failed to save reminder settings: Unknown error');
      expect(component.savingReminders).toBe(false);
    });

    it('should handle exception when saving', async () => {
      mockSupabaseService.client.rpc = vi.fn(() => {
        throw new Error('Network error');
      });

      await component.saveReminderSettings();

      expect(component.error).toBe('Failed to save reminder settings: Network error');
      expect(component.savingReminders).toBe(false);
      expect(mockToastService.error).toHaveBeenCalledWith('Failed to save reminder settings');
    });
    it('should save disabled reminders via RPC', async () => {
      const rpcMock = vi.fn(() => Promise.resolve({ error: null }));
      mockSupabaseService.client.rpc = rpcMock;
      vi.spyOn(component, 'loadSettings').mockResolvedValue(undefined);

      component.enableReminders = false;
      component.enableAutoArchive = false;

      await component.saveReminderSettings();

      expect(rpcMock).toHaveBeenCalledWith('update_tenant_reminder_settings', {
        p_tenant_id: MOCK_TENANT.id,
        p_enable_reminders: false,
        p_reminder_interval_days: 7,
        p_enable_auto_archive: false,
        p_days_before_archive: 7,
        p_email: 'admin@test.com'
      });
    });

    it('should reject save when Supabase session has no authenticated user', async () => {
      mockSupabaseService.client.auth.getSession = vi.fn(() =>
        Promise.resolve({ data: { session: null } })
      );

      const rpcMock = vi.fn(() => Promise.resolve({ error: null }));
      mockSupabaseService.client.rpc = rpcMock;

      component.enableReminders = true;
      vi.spyOn(component, 'loadSettings').mockResolvedValue(undefined);
      await component.saveReminderSettings();

      expect(rpcMock).not.toHaveBeenCalled();
      expect(mockToastService.error).toHaveBeenCalledWith('Not authenticated');
    });

    it('should reject load when Supabase session has no authenticated user', async () => {
      mockSupabaseService.client.auth.getSession = vi.fn(() =>
        Promise.resolve({ data: { session: null } })
      );

      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({
          data: [
            {
              enable_reminders: true,
              reminder_interval_days: 21,
              enable_auto_archive: false,
              days_before_archive: 14
            }
          ],
          error: null
        })
      );

      await component.loadSettings();

      expect(mockSupabaseService.client.rpc).not.toHaveBeenCalled();
      expect(component.error).toContain('Not authenticated');
    });
  });

  describe('onFormFieldChange', () => {
    it('should clear success and trigger change detection', () => {
      component.successReminders = true;
      component.onFormFieldChange();
      expect(component.successReminders).toBe(false);
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });
  });

  describe('onEnableRemindersChange', () => {
    it('should disable reminders and clear auto-archive when unchecked', () => {
      component.enableReminders = true;
      component.enableAutoArchive = true;

      component.onEnableRemindersChange(false);

      expect(component.enableReminders).toBe(false);
      expect(component.enableAutoArchive).toBe(false);
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should enable reminders when checked', () => {
      component.enableReminders = false;

      component.onEnableRemindersChange(true);

      expect(component.enableReminders).toBe(true);
    });

    it('should default reminder interval when enabling with invalid value', () => {
      component.reminderIntervalDays = null as unknown as number;

      component.onEnableRemindersChange(true);

      expect(component.reminderIntervalDays).toBe(7);
    });
  });

  describe('onEnableAutoArchiveChange', () => {
    it('should default archive days when enabling with blank value', () => {
      component.daysBeforeArchive = null as unknown as number;

      component.onEnableAutoArchiveChange(true);

      expect(component.enableAutoArchive).toBe(true);
      expect(component.daysBeforeArchive).toBe(7);
    });
  });

  describe('validateReminderDays', () => {
    it('should set reminderIntervalDays to 1 if less than 1', () => {
      component.reminderIntervalDays = 0;
      component.validateReminderDays();
      expect(component.reminderIntervalDays).toBe(1);
    });

    it('should set reminderIntervalDays to 1 if negative', () => {
      component.reminderIntervalDays = -5;
      component.validateReminderDays();
      expect(component.reminderIntervalDays).toBe(1);
    });

    it('should set reminderIntervalDays to 90 if greater than 90', () => {
      component.reminderIntervalDays = 100;
      component.validateReminderDays();
      expect(component.reminderIntervalDays).toBe(90);
    });

    it('should not change reminderIntervalDays if within valid range', () => {
      component.reminderIntervalDays = 30;
      component.validateReminderDays();
      expect(component.reminderIntervalDays).toBe(30);
    });

    it('should handle boundary value 1', () => {
      component.reminderIntervalDays = 1;
      component.validateReminderDays();
      expect(component.reminderIntervalDays).toBe(1);
    });

    it('should handle boundary value 90', () => {
      component.reminderIntervalDays = 90;
      component.validateReminderDays();
      expect(component.reminderIntervalDays).toBe(90);
    });
  });

  describe('validateArchiveDays', () => {
    it('should set daysBeforeArchive to 1 if less than 1', () => {
      component.daysBeforeArchive = 0;
      component.validateArchiveDays();
      expect(component.daysBeforeArchive).toBe(1);
    });

    it('should set daysBeforeArchive to 1 if negative', () => {
      component.daysBeforeArchive = -5;
      component.validateArchiveDays();
      expect(component.daysBeforeArchive).toBe(1);
    });

    it('should set daysBeforeArchive to 90 if greater than 90', () => {
      component.daysBeforeArchive = 100;
      component.validateArchiveDays();
      expect(component.daysBeforeArchive).toBe(90);
    });

    it('should not change daysBeforeArchive if within valid range', () => {
      component.daysBeforeArchive = 30;
      component.validateArchiveDays();
      expect(component.daysBeforeArchive).toBe(30);
    });

    it('should handle boundary value 1', () => {
      component.daysBeforeArchive = 1;
      component.validateArchiveDays();
      expect(component.daysBeforeArchive).toBe(1);
    });

    it('should handle boundary value 90', () => {
      component.daysBeforeArchive = 90;
      component.validateArchiveDays();
      expect(component.daysBeforeArchive).toBe(90);
    });
  });
});
