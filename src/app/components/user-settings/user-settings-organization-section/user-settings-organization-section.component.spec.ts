import { ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserSettingsOrganizationSectionComponent } from './user-settings-organization-section.component';
import { TenantContextService } from '../../../services/tenant-context.service';
import type { Tenant } from '../../../types/tenant';

function createComponent(options: Tenant[]) {
  const loading$ = new BehaviorSubject(false);
  const mockTenantContext = {
    loading$,
    activeTenant$: new BehaviorSubject({ id: 'a', name: 'Alpha' }),
    availableTenants$: new BehaviorSubject([]),
    memberships$: new BehaviorSubject([]),
    isSuperAdmin$: new BehaviorSubject(false),
    getActiveTenant: vi.fn(() => ({ id: 'a', name: 'Alpha' })),
    getTenantSwitcherOptions: vi.fn(() => options),
  };
  const component = new UserSettingsOrganizationSectionComponent(
    mockTenantContext as unknown as TenantContextService,
    { markForCheck: vi.fn() } as unknown as ChangeDetectorRef
  );
  component.ngOnInit();
  return { component, loading$ };
}

describe('UserSettingsOrganizationSectionComponent', () => {
  it('hides section for a single organization', () => {
    const { component } = createComponent([
      { id: 'a', name: 'Alpha', slug: 'alpha' } as Tenant,
    ]);
    expect(component.showSection).toBe(false);
  });

  it('shows section when user has multiple organizations', () => {
    const { component } = createComponent([
      { id: 'a', name: 'Alpha', slug: 'alpha' } as Tenant,
      { id: 'b', name: 'Beta', slug: 'beta' } as Tenant,
    ]);
    expect(component.showSection).toBe(true);
  });

  it('hides section while tenant context is loading', () => {
    const { component, loading$ } = createComponent([
      { id: 'a', name: 'Alpha', slug: 'alpha' } as Tenant,
      { id: 'b', name: 'Beta', slug: 'beta' } as Tenant,
    ]);
    loading$.next(true);
    expect(component.showSection).toBe(false);
  });
});
