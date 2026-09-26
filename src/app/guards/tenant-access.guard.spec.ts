import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { tenantAccessGuard } from './tenant-access.guard';
import { TenantAccessService } from '../services/tenant-access.service';
import { TenantContextService } from '../services/tenant-context.service';
import { of } from 'rxjs';

describe('tenantAccessGuard', () => {
  const resolveTargetTenant = vi.fn();
  const getState = vi.fn();
  const navigate = vi.fn();

  beforeEach(() => {
    resolveTargetTenant.mockReset();
    getState.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: TenantAccessService, useValue: { resolveTargetTenant, getState } },
        {
          provide: TenantContextService,
          useValue: { isSuperAdmin$: of(false) },
        },
        {
          provide: Router,
          useValue: { createUrlTree: navigate },
        },
      ],
    });
  });

  it('allows members and super admins', async () => {
    resolveTargetTenant.mockResolvedValue({ id: 't1', slug: 'a', name: 'A' });
    getState.mockResolvedValue({ state: 'member' });
    const result = await TestBed.runInInjectionContext(() =>
      tenantAccessGuard({} as never, { url: '/' } as never),
    );
    expect(result).toBe(true);
  });
});
