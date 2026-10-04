import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TenantAccessService } from './tenant-access.service';
import { SupabaseService } from './supabase.service';
import { AuthIdentityService } from './auth-identity.service';
import {
  readTenantAccessMemberCache,
  writeTenantAccessMemberCache,
} from '../lib/tenant-access-guard-cache';

vi.mock('../../environments/environment', () => ({
  environment: {
    platformHosts: ['prayer.romans8.net'],
    tenantHostSuffix: 'prayer.romans8.net',
  },
}));

describe('TenantAccessService', () => {
  let service: TenantAccessService;
  const rpcMock = vi.fn();
  const getSessionUserKey = vi.fn();
  const navigate = vi.fn();
  const createUrlTree = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => 'stale-tenant-id'),
    });
    sessionStorage.clear();
    getSessionUserKey.mockResolvedValue('user@example.com');
    createUrlTree.mockImplementation((commands: unknown[]) => commands);
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
        {
          provide: AuthIdentityService,
          useValue: { getSessionUserKey },
        },
        {
          provide: Router,
          useValue: { navigate, createUrlTree },
        },
      ],
    });
    service = TestBed.inject(TenantAccessService);
    rpcMock.mockReset();
    navigate.mockReset();
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

  it('resolveSlugHostMemberAccess allows when no slug host target', async () => {
    vi.stubGlobal('window', {
      location: { hostname: 'prayer.romans8.net' },
    });
    const result = await service.resolveSlugHostMemberAccess('/');
    expect(result).toBe(true);
  });

  it('resolveSlugHostMemberAccess uses session cache then revalidates', async () => {
    vi.stubGlobal('window', {
      location: { hostname: 'cross-pointe.prayer.romans8.net' },
    });
    writeTenantAccessMemberCache('t1', 'user@example.com');
    rpcMock.mockImplementation((name: string) => {
      if (name === 'get_public_tenant_by_slug') {
        return Promise.resolve({
          data: [{ id: 't1', name: 'CP', slug: 'cross-pointe' }],
          error: null,
        });
      }
      if (name === 'get_tenant_access_state') {
        return Promise.resolve({ data: { state: 'member' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await service.resolveSlugHostMemberAccess('/admin');
    expect(result).toBe(true);
    expect(readTenantAccessMemberCache('t1', 'user@example.com')).toBe(true);
    await vi.waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('get_tenant_access_state', {
        p_tenant_id: 't1',
      });
    });
  });

  it('resolveSlugHostMemberAccess returns request-access tree when not a member', async () => {
    vi.stubGlobal('window', {
      location: { hostname: 'cross-pointe.prayer.romans8.net' },
    });
    rpcMock.mockImplementation((name: string) => {
      if (name === 'get_public_tenant_by_slug') {
        return Promise.resolve({
          data: [{ id: 't1', name: 'CP', slug: 'cross-pointe' }],
          error: null,
        });
      }
      if (name === 'get_tenant_access_state') {
        return Promise.resolve({ data: { state: 'none' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await service.resolveSlugHostMemberAccess('/admin');
    expect(createUrlTree).toHaveBeenCalledWith(['/request-access'], {
      queryParams: { returnUrl: '/admin' },
    });
    expect(result).toEqual(['/request-access']);
  });

  it('completeProfile throws the database error message', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Membership not found' },
    });

    await expect(service.completeProfile('t1', 'Ada', 'Lovelace')).rejects.toThrow(
      'Membership not found',
    );
  });
});
