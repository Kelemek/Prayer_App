import { ChangeDetectorRef } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Subject } from 'rxjs';
import { TenantSwitcherDropdownComponent } from './tenant-switcher-dropdown.component';
import { TenantContextService } from '../../services/tenant-context.service';

describe('TenantSwitcherDropdownComponent', () => {
  let component: TenantSwitcherDropdownComponent;
  let mockTenantContext: {
    activeTenant$: Subject<{ id: string; name: string } | null>;
    availableTenants$: Subject<unknown[]>;
    memberships$: Subject<unknown[]>;
    getActiveTenant: ReturnType<typeof vi.fn>;
    getTenantSwitcherOptions: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockTenantContext = {
      activeTenant$: new Subject(),
      availableTenants$: new Subject(),
      memberships$: new Subject(),
      getActiveTenant: vi.fn(() => ({ id: 'tenant-a', name: 'Alpha Church' })),
      getTenantSwitcherOptions: vi.fn(() => [
        { id: 'tenant-a', name: 'Alpha Church' },
        { id: 'tenant-b', name: 'Beta Church' },
      ]),
    };

    component = new TenantSwitcherDropdownComponent(
      mockTenantContext as unknown as TenantContextService,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef
    );
    component.ngOnInit();
  });

  it('shows active tenant name', () => {
    expect(component.activeTenantName).toBe('Alpha Church');
    expect(component.tenantSwitchOptions).toHaveLength(2);
  });

  it('toggles dropdown and selects a different tenant', () => {
    const emitted: string[] = [];
    component.tenantSelected.subscribe((id) => emitted.push(id));

    component.toggleDropdown();
    expect(component.showDropdown).toBe(true);

    component.selectTenant('tenant-b');
    expect(emitted).toEqual(['tenant-b']);
    expect(component.showDropdown).toBe(false);
  });

  it('closes dropdown on escape', () => {
    component.toggleDropdown();
    component.onEscape();
    expect(component.showDropdown).toBe(false);
  });

  it('does not emit when selecting the active tenant', () => {
    const emitted: string[] = [];
    component.tenantSelected.subscribe((id) => emitted.push(id));

    component.selectTenant('tenant-a');
    expect(emitted).toEqual([]);
  });
});
