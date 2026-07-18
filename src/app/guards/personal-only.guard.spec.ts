import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { personalOnlyGuard } from './personal-only.guard';

type MockRouter = { createUrlTree: ReturnType<typeof vi.fn> };
type MockAdminAuthService = { loading$: BehaviorSubject<boolean> };
type MockTenantContextService = { loading$: BehaviorSubject<boolean> };
type MockTenantPermissionService = { isPersonalOnlyUser: ReturnType<typeof vi.fn> };

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

describe('personalOnlyGuard', () => {
  beforeEach(() => {
    mockRouter = {
      createUrlTree: vi.fn((commands: unknown[], extras?: { queryParams?: Record<string, string> }) => ({
        commands,
        queryParams: extras?.queryParams ?? {},
      })),
    };
    mockAdminAuthService = { loading$: new BehaviorSubject(false) };
    mockTenantContextService = { loading$: new BehaviorSubject(false) };
    mockPermissionService = { isPersonalOnlyUser: vi.fn(() => true) };
  });

  it('allows personal-only users', async () => {
    const result = await firstValueFrom(personalOnlyGuard({} as any, { url: '/personal' } as any));
    expect(result).toBe(true);
  });

  it('redirects non-personal users to home with denied flag', async () => {
    mockPermissionService.isPersonalOnlyUser.mockReturnValue(false);
    const result = await firstValueFrom(personalOnlyGuard({} as any, { url: '/personal' } as any));
    expect(result).not.toBe(true);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/'], {
      queryParams: { denied: 'personal', returnUrl: '/personal' },
    });
  });
});
