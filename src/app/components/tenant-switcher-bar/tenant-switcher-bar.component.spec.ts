import { ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantSwitcherBarComponent } from './tenant-switcher-bar.component';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';

describe('TenantSwitcherBarComponent', () => {
  let component: TenantSwitcherBarComponent;
  let mockTenantContext: {
    loading$: BehaviorSubject<boolean>;
    activeTenant$: BehaviorSubject<{ id: string; name: string } | null>;
    availableTenants$: BehaviorSubject<unknown[]>;
    memberships$: BehaviorSubject<unknown[]>;
    isSuperAdmin$: BehaviorSubject<boolean>;
    getActiveTenant: ReturnType<typeof vi.fn>;
    getTenantSwitcherOptions: ReturnType<typeof vi.fn>;
    switchTenant: ReturnType<typeof vi.fn>;
  };
  let toastError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockTenantContext = {
      loading$: new BehaviorSubject(false),
      activeTenant$: new BehaviorSubject({ id: 'tenant-a', name: 'Alpha Church' }),
      availableTenants$: new BehaviorSubject([]),
      memberships$: new BehaviorSubject([]),
      isSuperAdmin$: new BehaviorSubject(false),
      getActiveTenant: vi.fn(() => ({ id: 'tenant-a', name: 'Alpha Church' })),
      getTenantSwitcherOptions: vi.fn(() => [
        { id: 'tenant-a', name: 'Alpha Church' },
        { id: 'tenant-b', name: 'Beta Church' },
      ]),
      switchTenant: vi.fn(async () => true),
    };
    toastError = vi.fn();

    component = new TenantSwitcherBarComponent(
      mockTenantContext as unknown as TenantContextService,
      { error: toastError } as unknown as ToastService,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef
    );
    component.ngOnInit();
  });

  it('is visible when loaded with multiple tenant options', () => {
    expect(component.visible).toBe(true);
    expect(component.activeTenantName).toBe('Alpha Church');
  });

  it('switches tenant and closes dropdown', async () => {
    component.toggleTenantDropdown();
    await component.selectTenant('tenant-b');
    expect(mockTenantContext.switchTenant).toHaveBeenCalledWith('tenant-b');
    expect(component.showTenantDropdown).toBe(false);
  });

  it('shows toast when switch fails', async () => {
    mockTenantContext.switchTenant.mockResolvedValue(false);
    await component.onTenantSelect('tenant-b');
    expect(toastError).toHaveBeenCalledWith('Unable to switch organization');
  });

  it('closes dropdown on outside click', () => {
    component.toggleTenantDropdown();
    const outside = document.createElement('div');
    component.onDocumentClick({ target: outside } as MouseEvent);
    expect(component.showTenantDropdown).toBe(false);
  });

  it('closes dropdown on escape', () => {
    component.toggleTenantDropdown();
    component.onEscape();
    expect(component.showTenantDropdown).toBe(false);
  });
});
