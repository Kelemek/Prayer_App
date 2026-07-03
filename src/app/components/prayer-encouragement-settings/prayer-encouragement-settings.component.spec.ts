import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';
import { PrayerEncouragementSettingsComponent } from './prayer-encouragement-settings.component';
import { SupabaseService } from '../../services/supabase.service';
import { PrayerEncouragementService } from '../../services/prayer-encouragement.service';

const TENANT_ID = 'tenant-test-id';
const mockTenant = { id: TENANT_ID, name: 'T', slug: 't' };

describe('PrayerEncouragementSettingsComponent', () => {
  let component: PrayerEncouragementSettingsComponent;
  let mockSupabase: any;
  let mockPrayerEncouragementService: any;
  let mockTenantContext: {
    getActiveTenant: ReturnType<typeof vi.fn>;
    activeTenant$: BehaviorSubject<typeof mockTenant | null>;
  };
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        prayer_encouragement_enabled: true,
        prayer_encouragement_cooldown_hours: 4,
      },
      error: null,
    });
    mockSupabase = {
      client: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
          }),
          update: vi
            .fn()
            .mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }),
      },
    };

    mockPrayerEncouragementService = {
      invalidateFlagCache: vi.fn(),
    };

    mockTenantContext = {
      getActiveTenant: vi.fn().mockReturnValue(mockTenant),
      activeTenant$: new BehaviorSubject(mockTenant),
    };

    mockCdr = {
      markForCheck: vi.fn(),
    };

    component = new PrayerEncouragementSettingsComponent(
      mockSupabase,
      mockPrayerEncouragementService,
      mockTenantContext as any,
      mockCdr as unknown as ChangeDetectorRef
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default collapsed state', () => {
    expect(component.sectionExpanded).toBe(false);
    expect(component.prayerEncouragementEnabled).toBe(false);
    expect(component.cooldownHours).toBe(4);
    expect(component.isSaving).toBe(false);
    expect(component.isLoading).toBe(false);
    expect(component.successMessage).toBe('');
    expect(component.errorMessage).toBe('');
  });

  describe('ngOnInit', () => {
    it('should not load settings until section is expanded', async () => {
      component.ngOnInit();
      await Promise.resolve();
      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });

    it('should reload when tenant changes while expanded', async () => {
      component.ngOnInit();
      component.onExpandedChange(true);
      await component.loadSettings();
      mockSupabase.client.from.mockClear();

      mockTenantContext.activeTenant$.next({
        ...mockTenant,
        id: 'tenant-other',
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(mockSupabase.client.from).toHaveBeenCalledWith('tenant_settings');
    });

    it('should reset form when tenant is cleared', () => {
      component.ngOnInit();
      component.prayerEncouragementEnabled = true;
      component.cooldownHours = 8;
      component.successMessage = 'saved';
      component.errorMessage = 'err';

      mockTenantContext.getActiveTenant.mockReturnValue(null);
      mockTenantContext.activeTenant$.next(null);

      expect(component.prayerEncouragementEnabled).toBe(false);
      expect(component.cooldownHours).toBe(4);
      expect(component.successMessage).toBe('');
      expect(component.errorMessage).toBe('');
    });
  });

  describe('onExpandedChange', () => {
    it('should lazy-load settings on first expand', async () => {
      component.onExpandedChange(true);
      await component.loadSettings();

      expect(component.sectionExpanded).toBe(true);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('tenant_settings');
      expect(component.prayerEncouragementEnabled).toBe(true);
    });

    it('should not re-fetch on second expand', async () => {
      component.onExpandedChange(true);
      await component.loadSettings();
      mockSupabase.client.from.mockClear();

      component.onExpandedChange(false);
      component.onExpandedChange(true);

      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });
  });

  describe('loadSettings', () => {
    it('should set prayerEncouragementEnabled from response', async () => {
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                prayer_encouragement_enabled: false,
                prayer_encouragement_cooldown_hours: 6,
              },
              error: null,
            }),
          }),
        }),
      });
      await component.loadSettings();
      expect(component.prayerEncouragementEnabled).toBe(false);
      expect(component.cooldownHours).toBe(6);
    });

    it('should set errorMessage when load fails', async () => {
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockRejectedValue(new Error('Network error')),
          }),
        }),
      });
      await component.loadSettings();
      expect(component.errorMessage).toBe('Failed to load settings.');
      expect(component.sectionExpanded).toBe(true);
    });

    it('should skip fetch when no active tenant', async () => {
      mockTenantContext.getActiveTenant.mockReturnValue(null);
      await component.loadSettings();
      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });
  });

  describe('submitSettings', () => {
    it('should update tenant_settings and call invalidateFlagCache on success', async () => {
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                prayer_encouragement_enabled: true,
                prayer_encouragement_cooldown_hours: 4,
              },
              error: null,
            }),
          }),
        }),
        update: mockUpdate,
      });

      component.prayerEncouragementEnabled = true;
      component.cooldownHours = 4;
      await component.submitSettings();

      expect(mockSupabase.client.from).toHaveBeenCalledWith('tenant_settings');
      expect(mockUpdate).toHaveBeenCalledWith({
        prayer_encouragement_enabled: true,
        prayer_encouragement_cooldown_hours: 4,
      });
      expect(mockUpdateEq).toHaveBeenCalledWith('tenant_id', TENANT_ID);
      expect(mockPrayerEncouragementService.invalidateFlagCache).toHaveBeenCalled();
      expect(component.successMessage).toBe(
        'Prayer Encouragement settings saved.'
      );
      expect(component.isSaving).toBe(false);
    });

    it('should set errorMessage when save fails', async () => {
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: new Error('Update failed') }),
        }),
      });
      await component.submitSettings();
      expect(component.errorMessage).toBe(
        'Failed to save settings. Please try again.'
      );
      expect(component.isSaving).toBe(false);
    });

    it('should set errorMessage when no tenant selected', async () => {
      mockTenantContext.getActiveTenant.mockReturnValue(null);
      await component.submitSettings();
      expect(component.errorMessage).toBe('No active organization selected.');
    });
  });
});
