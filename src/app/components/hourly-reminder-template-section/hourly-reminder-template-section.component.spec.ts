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

  it('ngOnInit sets expanded and selectedKey then loads', async () => {
    component.startExpanded = true;
    component.defaultKey = 'user_hourly_memorization_reminder';
    component.ngOnInit();
    expect(component.expanded).toBe(true);
    expect(component.selectedKey).toBe('user_hourly_memorization_reminder');
    await vi.waitFor(() => expect(component.loading).toBe(false));
  });

  it('toggleExpanded flips expanded and marks for check', () => {
    component.expanded = false;
    component.toggleExpanded();
    expect(component.expanded).toBe(true);
    expect(mockCdr.markForCheck).toHaveBeenCalled();
  });

  it('selectedLabel returns matching or fallback labels', () => {
    component.selectedKey = 'user_hourly_memorization_reminder_with_spotlight';
    expect(component.selectedLabel()).toBe('Spotlight');
    component.selectedKey = 'unknown';
    expect(component.selectedLabel()).toBe('Simple nudge (default)');
    component.templateOptions = [];
    expect(component.selectedLabel()).toBe('Simple nudge (default)');
  });

  it('setTemplateKey updates selection and closes dropdown', () => {
    component.showDropdown = true;
    component.setTemplateKey('user_hourly_memorization_reminder');
    expect(component.selectedKey).toBe('user_hourly_memorization_reminder');
    expect(component.showDropdown).toBe(false);
  });

  it('load resets to default when no tenant', async () => {
    mockTenantContext.getActiveTenant.mockReturnValue(null);
    component.defaultKey = 'user_hourly_memorization_reminder';
    await component.load();
    expect(component.selectedKey).toBe('user_hourly_memorization_reminder');
    expect(component.loading).toBe(false);
  });

  it('load emits loadFailed on error with message', async () => {
    const loadFailed = vi.fn();
    component.loadFailed.subscribe(loadFailed);
    mockSupabase.client.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve({ data: null, error: { message: 'db down' } })
          ),
        })),
      })),
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await component.load();
    expect(component.loadError).toContain('db down');
    expect(loadFailed).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('load uses Unknown error when thrown value has no message', async () => {
    mockSupabase.client.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.reject('fail')),
        })),
      })),
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await component.load();
    expect(component.loadError).toContain('Unknown error');
    errSpy.mockRestore();
  });

  it('save requires tenant and handles save errors', async () => {
    mockTenantContext.getActiveTenant.mockReturnValue(null);
    await component.save();
    expect(mockToast.error).toHaveBeenCalledWith('Select an organization first.');

    mockTenantContext.getActiveTenant.mockReturnValue({ id: TENANT_ID });
    mockSupabase.client.from.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: { message: 'write failed' } })),
      })),
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await component.save();
    expect(component.loadError).toContain('write failed');
    expect(mockToast.error).toHaveBeenCalledWith(
      'Failed to save memorization reminder template'
    );
    errSpy.mockRestore();
  });
});
