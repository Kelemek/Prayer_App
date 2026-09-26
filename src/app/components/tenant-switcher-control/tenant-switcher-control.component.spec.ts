import { ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantSwitcherControlComponent } from './tenant-switcher-control.component';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';

describe('TenantSwitcherControlComponent', () => {
  let component: TenantSwitcherControlComponent;
  let mockTenantContext: {
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
      activeTenant$: new BehaviorSubject({ id: 'tenant-a', name: 'Alpha Church' }),
      availableTenants$: new BehaviorSubject([]),
      memberships$: new BehaviorSubject([]),
      isSuperAdmin$: new BehaviorSubject(false),
      getActiveTenant: vi.fn(() => ({ id: 'tenant-a', name: 'Alpha Church' })),
      getTenantSwitcherOptions: vi.fn(() => [
        { id: 'tenant-a', name: 'Alpha Church', slug: 'alpha' },
        { id: 'tenant-b', name: 'Beta Church', slug: 'beta' },
      ]),
      switchTenant: vi.fn(async () => true),
    };
    toastError = vi.fn();

    component = new TenantSwitcherControlComponent(
      mockTenantContext as unknown as TenantContextService,
      { error: toastError } as unknown as ToastService,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef
    );
    component.ngOnInit();
  });

  it('shows active tenant name', () => {
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

  it('closes dropdown on outside click (capture, before modal stopPropagation)', () => {
    component.toggleTenantDropdown();
    const panel = document.createElement('div');
    panel.addEventListener('click', (event) => event.stopPropagation());
    const inner = document.createElement('button');
    panel.appendChild(inner);
    document.body.appendChild(panel);
    inner.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );
    panel.remove();
    expect(component.showTenantDropdown).toBe(false);
  });

  it('closes dropdown on escape', () => {
    component.toggleTenantDropdown();
    component.onEscape();
    expect(component.showTenantDropdown).toBe(false);
  });
});
