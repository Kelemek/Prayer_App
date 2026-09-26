import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TenantAccessService } from './tenant-access.service';
import { SupabaseService } from './supabase.service';

vi.mock('../../environments/environment', () => ({
  environment: {
    platformHosts: ['prayer.romans8.net'],
    tenantHostSuffix: 'prayer.romans8.net',
  },
}));

describe('TenantAccessService', () => {
  let service: TenantAccessService;
  const rpcMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => 'stale-tenant-id'),
    });
    TestBed.configureTestingModule({
      providers: [
        TenantAccessService,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              rpc: rpcMock,
              functions: { invoke: vi.fn() },
            },
          },
        },
      ],
    });
    service = TestBed.inject(TenantAccessService);
    rpcMock.mockReset();
  });

  it('resolveTargetTenant uses host slug, not localStorage', async () => {
    vi.stubGlobal('window', {
      location: { hostname: 'cross-pointe.prayer.romans8.net' },
    });
    rpcMock.mockResolvedValue({
      data: [{ id: 't1', name: 'CP', slug: 'cross-pointe' }],
      error: null,
    });

    const tenant = await service.resolveTargetTenant(null);
    expect(tenant?.slug).toBe('cross-pointe');
    expect(rpcMock).toHaveBeenCalledWith('get_public_tenant_by_slug', {
      p_slug: 'cross-pointe',
    });
  });

  it('resolveTargetTenant uses church query on platform host', async () => {
    vi.stubGlobal('window', {
      location: { hostname: 'prayer.romans8.net' },
    });
    rpcMock.mockResolvedValue({
      data: [{ id: 't2', name: 'B', slug: 'church-b' }],
      error: null,
    });

    const tenant = await service.resolveTargetTenant('church-b');
    expect(tenant?.id).toBe('t2');
  });
});
