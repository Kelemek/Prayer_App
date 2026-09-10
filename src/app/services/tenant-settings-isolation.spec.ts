import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrayerAllowancePolicyService } from './prayer-allowance-policy.service';

describe('tenant settings isolation', () => {
  let fromMock: ReturnType<typeof vi.fn>;
  let eqMock: ReturnType<typeof vi.fn>;
  let getActiveTenant: ReturnType<typeof vi.fn>;
  let service: PrayerAllowancePolicyService;

  beforeEach(() => {
    eqMock = vi.fn();
    fromMock = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: eqMock,
      })),
    }));
    getActiveTenant = vi.fn(() => null);

    service = new PrayerAllowancePolicyService(
      { client: { from: fromMock } } as any,
      { getActiveTenant } as any
    );
  });

  it('does not read admin_settings when no church is selected', async () => {
    await service.load();

    expect(fromMock).not.toHaveBeenCalled();
    expect(service.deletionsAllowed).toBe('everyone');
    expect(service.updatesAllowed).toBe('everyone');
  });

  it('loads Church A policies without affecting Church B', async () => {
    eqMock.mockImplementation((_column: string, tenantId: string) => ({
      maybeSingle: vi.fn().mockResolvedValue({
        data:
          tenantId === 'tenant-a'
            ? { deletions_allowed: 'admin-only', updates_allowed: 'admin-only' }
            : { deletions_allowed: 'everyone', updates_allowed: 'original-requestor' },
        error: null,
      }),
    }));

    getActiveTenant.mockReturnValue({ id: 'tenant-a' });
    await service.load();
    expect(fromMock).toHaveBeenCalledWith('tenant_settings');
    expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(service.deletionsAllowed).toBe('admin-only');
    expect(service.updatesAllowed).toBe('admin-only');

    getActiveTenant.mockReturnValue({ id: 'tenant-b' });
    await service.load();
    expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-b');
    expect(service.deletionsAllowed).toBe('everyone');
    expect(service.updatesAllowed).toBe('original-requestor');
  });
});
