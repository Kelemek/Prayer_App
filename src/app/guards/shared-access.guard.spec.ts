import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { sharedAccessGuard } from './shared-access.guard';

type MockRouter = { createUrlTree: ReturnType<typeof vi.fn> };
type MockAdminAuthService = { loading$: BehaviorSubject<boolean> };
type MockTenantContextService = { loading$: BehaviorSubject<boolean> };
type MockTenantPermissionService = { canAccessShared: ReturnType<typeof vi.fn> };

let mockRouter: MockRouter;
let mockAdminAuthService: MockAdminAuthService;
let mockTenantContextService: MockTenantContextService;
let mockPermissionService: MockTenantPermissionService;

vi.mock('@angular/core', async () => {
  const actual = await vi.importActual<typeof import('@angular/core')>('@angular/core');
  return {
    ...actual,
    inject: (token: unknown) => {
      const tokenName = (token as { name?: string })?.name || String(token);
      if (tokenName === 'Router') return mockRouter;
      if (tokenName === 'AdminAuthService') return mockAdminAuthService;
      if (tokenName === 'TenantContextService') return mockTenantContextService;
      if (tokenName === 'TenantPermissionService') return mockPermissionService;
      return null;
    },
  };
});

describe('sharedAccessGuard', () => {
  beforeEach(() => {
    mockRouter = {
      createUrlTree: vi.fn((commands: unknown[], extras?: { queryParams?: Record<string, string> }) => ({
        commands,
        queryParams: extras?.queryParams ?? {},
      })),
    };
    mockAdminAuthService = { loading$: new BehaviorSubject(false) };
    mockTenantContextService = { loading$: new BehaviorSubject(false) };
    mockPermissionService = { canAccessShared: vi.fn(() => true) };
  });

  it('allows users with shared access', async () => {
    const result = await firstValueFrom(sharedAccessGuard({} as any, { url: '/shared' } as any));
    expect(result).toBe(true);
  });

  it('redirects users without shared access', async () => {
    mockPermissionService.canAccessShared.mockReturnValue(false);
    const result = await firstValueFrom(sharedAccessGuard({} as any, { url: '/shared' } as any));
    expect(result).not.toBe(true);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/'], {
      queryParams: { denied: 'shared', returnUrl: '/shared' },
    });
  });
});
