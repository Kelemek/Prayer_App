import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';
import { MemorizationReciteSettingsComponent } from './memorization-recite-settings.component';
import { SupabaseService } from '../../services/supabase.service';
import { MemorizationReciteSettingsService } from '../../services/memorization-recite-settings.service';

const TENANT_ID = 'tenant-test-id';
const mockTenant = { id: TENANT_ID, name: 'T', slug: 't' };

describe('MemorizationReciteSettingsComponent', () => {
  let component: MemorizationReciteSettingsComponent;
  let mockSupabase: {
    client: {
      auth: { getSession: ReturnType<typeof vi.fn> };
      rpc: ReturnType<typeof vi.fn>;
    };
  };
  let mockReciteSettings: {
    invalidateCache: ReturnType<typeof vi.fn>;
    fetchUsageSummaryForAdmin: ReturnType<typeof vi.fn>;
    fetchOpenAiOrgUsage: ReturnType<typeof vi.fn>;
  };
  let mockTenantContext: {
    getActiveTenant: ReturnType<typeof vi.fn>;
    activeTenant$: BehaviorSubject<typeof mockTenant | null>;
  };
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      client: {
        auth: {
          getSession: vi.fn(() =>
            Promise.resolve({
              data: {
                session: {
                  user: { email: 'admin@test.com' },
                },
              },
            })
          ),
        },
        rpc: vi.fn(() =>
          Promise.resolve({
            data: [
              {
                memorization_recite_enabled: true,
                memorization_recite_stt_provider: 'whisper',
                memorization_recite_whisper_model: 'gpt-4o-mini-transcribe',
              },
            ],
            error: null,
          })
        ),
      },
    };

    mockReciteSettings = {
      invalidateCache: vi.fn(),
      fetchUsageSummaryForAdmin: vi.fn().mockResolvedValue({
        attemptCount: 2,
        whisperAttemptCount: 1,
        browserAttemptCount: 1,
        billableAudioSeconds: 30,
        estimatedCostUsd: 0.003,
      }),
      fetchOpenAiOrgUsage: vi.fn().mockResolvedValue({
        configured: false,
      }),
    };

    mockTenantContext = {
      getActiveTenant: vi.fn().mockReturnValue(mockTenant),
      activeTenant$: new BehaviorSubject(mockTenant),
    };

    mockCdr = {
      markForCheck: vi.fn(),
    };

    component = new MemorizationReciteSettingsComponent(
      mockSupabase as unknown as SupabaseService,
      mockReciteSettings as unknown as MemorizationReciteSettingsService,
      mockTenantContext as never,
      mockCdr as unknown as ChangeDetectorRef
    );
    component.ngOnInit();
  });

  it('creates with collapsed defaults', () => {
    expect(component).toBeTruthy();
    expect(component.sectionExpanded).toBe(false);
    expect(component.reciteEnabled).toBe(false);
    expect(component.sttProvider).toBe('browser');
  });

  it('loads settings when expanded', async () => {
    component.onExpandedChange(true);
    await component['loadSettings']();

    expect(mockSupabase.client.rpc).toHaveBeenCalledWith(
      'get_tenant_memorization_recite_settings',
      expect.objectContaining({ p_tenant_id: TENANT_ID })
    );
    expect(component.reciteEnabled).toBe(true);
    expect(component.sttProvider).toBe('whisper');
    expect(component.whisperModel).toBe('gpt-4o-mini-transcribe');
    expect(mockReciteSettings.fetchUsageSummaryForAdmin).toHaveBeenCalled();
  });

  it('saves settings via RPC and invalidates cache', async () => {
    component.reciteEnabled = true;
    component.sttProvider = 'whisper';
    component.whisperModel = 'gpt-4o-mini-transcribe';
    await component.submitSettings();

    expect(mockSupabase.client.rpc).toHaveBeenCalledWith(
      'update_tenant_memorization_recite_settings',
      expect.objectContaining({
        p_tenant_id: TENANT_ID,
        p_memorization_recite_enabled: true,
        p_memorization_recite_stt_provider: 'whisper',
        p_memorization_recite_whisper_model: 'gpt-4o-mini-transcribe',
      })
    );
    expect(mockReciteSettings.invalidateCache).toHaveBeenCalled();
    expect(component.successMessage).toContain('saved');
  });

  it('reloads settings after tenant switch when section re-expands', async () => {
    const tenantB = { id: 'tenant-b-id', name: 'B', slug: 'b' };

    component.onExpandedChange(true);
    await vi.waitFor(() => expect(component.isLoading).toBe(false));
    expect(component.sttProvider).toBe('whisper');
    expect(component['dataLoadedForTenantId']).toBe(TENANT_ID);

    component.onExpandedChange(false);
    mockSupabase.client.rpc.mockImplementation((name: string) => {
      if (name === 'get_tenant_memorization_recite_settings') {
        return Promise.resolve({
          data: [
            {
              memorization_recite_enabled: false,
              memorization_recite_stt_provider: 'browser',
              memorization_recite_whisper_model: 'whisper-1',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });
    mockTenantContext.getActiveTenant.mockReturnValue(tenantB);
    mockTenantContext.activeTenant$.next(tenantB);

    expect(component.sttProvider).toBe('browser');
    expect(component.reciteEnabled).toBe(false);

    component.onExpandedChange(true);
    await vi.waitFor(() => expect(component['dataLoadedForTenantId']).toBe(tenantB.id));

    expect(mockSupabase.client.rpc).toHaveBeenCalledWith(
      'get_tenant_memorization_recite_settings',
      expect.objectContaining({ p_tenant_id: tenantB.id })
    );
    expect(component.sttProvider).toBe('browser');
  });
});
