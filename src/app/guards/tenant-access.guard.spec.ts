import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { tenantAccessGuard } from './tenant-access.guard';
import { TenantAccessService } from '../services/tenant-access.service';
import { TenantContextService } from '../services/tenant-context.service';
import { of } from 'rxjs';

describe('tenantAccessGuard', () => {
  const resolveSlugHostMemberAccess = vi.fn();
  const createUrlTree = vi.fn();

  beforeEach(() => {
    resolveSlugHostMemberAccess.mockReset();
    createUrlTree.mockReset();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TenantAccessService,
          useValue: { resolveSlugHostMemberAccess },
        },
        {
          provide: TenantContextService,
          useValue: { isSuperAdmin$: of(false) },
        },
        {
          provide: Router,
          useValue: { createUrlTree },
        },
      ],
    });
  });

  it('allows members via service resolution', async () => {
    resolveSlugHostMemberAccess.mockResolvedValue(true);
    const result = await TestBed.runInInjectionContext(() =>
      tenantAccessGuard({} as never, { url: '/' } as never)
    );
    expect(result).toBe(true);
    expect(resolveSlugHostMemberAccess).toHaveBeenCalledWith('/');
  });

  it('returns UrlTree from service when access denied', async () => {
    const tree = {} as UrlTree;
    createUrlTree.mockReturnValue(tree);
    resolveSlugHostMemberAccess.mockResolvedValue(tree);
    const result = await TestBed.runInInjectionContext(() =>
      tenantAccessGuard({} as never, { url: '/admin' } as never)
    );
    expect(result).toBe(tree);
  });

  it('skips slug check for super admins', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TenantAccessService,
          useValue: { resolveSlugHostMemberAccess },
        },
        {
          provide: TenantContextService,
          useValue: { isSuperAdmin$: of(true) },
        },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });
    const result = await TestBed.runInInjectionContext(() =>
      tenantAccessGuard({} as never, { url: '/' } as never)
    );
    expect(result).toBe(true);
    expect(resolveSlugHostMemberAccess).not.toHaveBeenCalled();
  });
});
