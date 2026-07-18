import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantMembershipPreferencesService } from './tenant-membership-preferences.service';

describe('TenantMembershipPreferencesService', () => {
  let service: TenantMembershipPreferencesService;
  let fromMock: ReturnType<typeof vi.fn>;
  let matchMock: ReturnType<typeof vi.fn>;
  let maybeSingleMock: ReturnType<typeof vi.fn>;
  let updateMock: ReturnType<typeof vi.fn>;
  let insertMock: ReturnType<typeof vi.fn>;
  const tenantContext = {
    getActiveTenant: vi.fn(() => ({ id: 'tenant-1' })),
  };

  beforeEach(() => {
    maybeSingleMock = vi.fn();
    matchMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    updateMock = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    insertMock = vi.fn().mockResolvedValue({ error: null });
    fromMock = vi.fn(() => ({
      select: vi.fn(() => ({ match: matchMock })),
      update: updateMock,
      insert: insertMock,
    }));

    service = new TenantMembershipPreferencesService(
      { client: { from: fromMock } } as any,
      tenantContext as any
    );
  });

  it('matchFilter includes tenant_id when active', () => {
    expect(service.matchFilter('user@example.com')).toEqual({
      user_email: 'user@example.com',
      tenant_id: 'tenant-1',
    });
  });

  it('upsert updates existing row by id', async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: 'row-1' }, error: null });
    const result = await service.upsert('user@example.com', { is_active: false });
    expect(result).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith({ is_active: false });
  });

  it('upsert inserts when row missing', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const result = await service.upsert(
      'user@example.com',
      { receive_push: true },
      { name: 'Test User' }
    );
    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({
      user_email: 'user@example.com',
      role: 'member',
      tenant_id: 'tenant-1',
      name: 'Test User',
      receive_push: true,
    });
  });

  it('updateOnly matches email and tenant', async () => {
    updateMock.mockReturnValue({
      match: vi.fn().mockResolvedValue({ error: null }),
    });
    const result = await service.updateOnly('user@example.com', {
      memorization_strict_mode: true,
    });
    expect(result).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith({ memorization_strict_mode: true });
  });

  it('upsert returns error when update fails', async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: 'row-1' }, error: null });
    updateMock.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: new Error('update failed') }),
    });
    const result = await service.upsert('user@example.com', { is_active: false });
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });

  it('matchFilter omits tenant_id when no active tenant', () => {
    tenantContext.getActiveTenant.mockReturnValueOnce(null);
    expect(service.matchFilter('user@example.com')).toEqual({
      user_email: 'user@example.com',
    });
  });
});
