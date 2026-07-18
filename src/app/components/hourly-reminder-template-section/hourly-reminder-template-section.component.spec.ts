import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { HourlyReminderTemplateSectionComponent } from './hourly-reminder-template-section.component';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { TenantContextService } from '../../services/tenant-context.service';

const TENANT_ID = 'tenant-1';

describe('HourlyReminderTemplateSectionComponent', () => {
  let component: HourlyReminderTemplateSectionComponent;
  let mockSupabase: { client: { from: ReturnType<typeof vi.fn> } };
  let mockToast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };
  let mockTenantContext: { getActiveTenant: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSupabase = {
      client: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: {
                    user_hourly_memorization_reminder_template_key:
                      'user_hourly_memorization_reminder_with_spotlight',
                  },
                  error: null,
                })
              ),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      },
    };
    mockToast = { success: vi.fn(), error: vi.fn() };
    mockCdr = { markForCheck: vi.fn() };
    mockTenantContext = {
      getActiveTenant: vi.fn(() => ({ id: TENANT_ID })),
    };

    component = new HourlyReminderTemplateSectionComponent(
      mockSupabase as unknown as SupabaseService,
      mockToast as unknown as ToastService,
      mockTenantContext as unknown as TenantContextService,
      mockCdr as unknown as ChangeDetectorRef
    );
    component.sectionTitle = 'Hourly user memorization reminder email';
    component.descriptionHtml = 'desc';
    component.settingsColumn = 'user_hourly_memorization_reminder_template_key';
    component.templateOptions = [
      { value: 'user_hourly_memorization_reminder', label: 'Simple nudge (default)' },
      {
        value: 'user_hourly_memorization_reminder_with_spotlight',
        label: 'Spotlight',
      },
    ];
    component.allowedKeys = [
      'user_hourly_memorization_reminder',
      'user_hourly_memorization_reminder_with_spotlight',
    ];
    component.defaultKey = 'user_hourly_memorization_reminder';
    component.helpText = 'help';
    component.loadingMessage = 'Loading…';
    component.successMessage = 'Saved.';
    component.saveToastMessage = 'Hourly memorization reminder template saved.';
    component.saveErrorToastMessage = 'Failed to save memorization reminder template';
    component.loadErrorPrefix = 'Failed to load memorization hourly reminder template';
    component.saveErrorPrefix = 'Failed to save memorization hourly reminder template';
  });

  it('load reads template key from tenant_settings', async () => {
    await component.load();
    expect(component.selectedKey).toBe('user_hourly_memorization_reminder_with_spotlight');
    expect(component.loading).toBe(false);
  });

  it('save persists selected template key', async () => {
    component.selectedKey = 'user_hourly_memorization_reminder_with_spotlight';
    const saved = vi.fn();
    component.saved.subscribe(saved);

    await component.save();

    expect(mockSupabase.client.from).toHaveBeenCalledWith('tenant_settings');
    expect(component.success).toBe(true);
    expect(mockToast.success).toHaveBeenCalledWith('Hourly memorization reminder template saved.');
    expect(saved).toHaveBeenCalled();
    expect(component.saving).toBe(false);
  });
});
