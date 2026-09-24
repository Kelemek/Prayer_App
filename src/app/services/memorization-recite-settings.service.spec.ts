import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { MemorizationReciteSettingsService } from './memorization-recite-settings.service';

describe('MemorizationReciteSettingsService', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let activeTenant$: BehaviorSubject<{ id: string } | null>;
  let service: MemorizationReciteSettingsService;

  beforeEach(() => {
    localStorage.clear();
    rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    activeTenant$ = new BehaviorSubject<{ id: string } | null>({ id: 'tenant-1' });
    service = new MemorizationReciteSettingsService(
      {
        client: { rpc, auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
        getSupabaseUrl: () => 'https://example.supabase.co',
        getPublishableKey: () => 'pk',
      } as never,
      {
        activeTenant$,
        getActiveTenant: () => activeTenant$.value,
      } as never
    );
  });

  it('loads settings from rpc', async () => {
    rpc.mockResolvedValue({
      data: {
        memorization_recite_enabled: true,
        memorization_recite_stt_provider: 'whisper',
        memorization_recite_whisper_model: 'whisper-1',
      },
      error: null,
    });
    const settings = await service.getSettingsForActiveTenant();
    expect(settings.enabled).toBe(true);
    expect(settings.sttProvider).toBe('whisper');
  });

  it('invalidateCache triggers a reload', async () => {
    rpc.mockResolvedValue({
      data: { memorization_recite_enabled: false },
      error: null,
    });
    service.invalidateCache();
    const settings = await service.getSettingsForActiveTenant();
    expect(settings.enabled).toBe(false);
    expect(rpc).toHaveBeenCalled();
  });

  it('fetchUsageSummaryForAdmin maps rpc row', async () => {
    rpc.mockResolvedValue({
      data: [{ attempt_count: 2, total_audio_seconds: 10, estimated_cost_usd: 0.5 }],
      error: null,
    });
    const summary = await service.fetchUsageSummaryForAdmin('tenant-1', 'u@example.com');
    expect(summary?.attemptCount).toBe(2);
    expect(summary?.estimatedCostUsd).toBe(0.5);
  });

  it('fetchUsageSummaryForAdmin returns null on rpc error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });
    expect(await service.fetchUsageSummaryForAdmin('tenant-1', 'u@example.com')).toBeNull();
    errSpy.mockRestore();
  });

  it('fetchUsageSummaryForAdmin returns zeros when row missing', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const summary = await service.fetchUsageSummaryForAdmin('tenant-1', 'u@example.com');
    expect(summary?.attemptCount).toBe(0);
  });

  it('getSettingsForActiveTenant uses defaults without active tenant', async () => {
    activeTenant$.next(null);
    const settings = await service.getSettingsForActiveTenant();
    expect(settings.enabled).toBe(false);
  });

  it('getSettings$ triggers load and ngOnDestroy cleans up', async () => {
    const sub = service.getSettings$().subscribe();
    service.ngOnDestroy();
    sub.unsubscribe();
    expect(rpc).toHaveBeenCalled();
  });

  it('fetchOpenAiOrgUsage returns payload', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        configured: true,
        period_days: 30,
        total_usd: 1.2,
        audio_transcription_usd: 0.4,
      }),
    });
    const usage = await service.fetchOpenAiOrgUsage('u@example.com', 'tenant-1');
    expect(usage.configured).toBe(true);
    expect(usage.totalUsd).toBe(1.2);
  });

  it('fetchOpenAiOrgUsage surfaces errors when response not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'denied' }),
    });
    const usage = await service.fetchOpenAiOrgUsage('u@example.com', 'tenant-1');
    expect(usage.configured).toBe(false);
    expect(usage.error).toBe('denied');
  });
});
