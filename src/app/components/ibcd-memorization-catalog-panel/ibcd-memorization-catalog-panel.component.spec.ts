import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { IbcdMemorizationCatalogPanelComponent } from './ibcd-memorization-catalog-panel.component';

describe('IbcdMemorizationCatalogPanelComponent', () => {
  let component: IbcdMemorizationCatalogPanelComponent;
  let activeTenant$: Subject<{ id: string } | null>;
  let getIbcdCatalogStatus: ReturnType<typeof vi.fn>;
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    activeTenant$ = new Subject();
    getIbcdCatalogStatus = vi.fn().mockResolvedValue({
      applied: false,
      ibcdCategoryCount: 0,
      ibcdVerseCount: 0,
    });
    mockCdr = { markForCheck: vi.fn() };

    component = new IbcdMemorizationCatalogPanelComponent(
      { getIbcdCatalogStatus, applyIbcdCatalog: vi.fn(), removeIbcdCatalog: vi.fn() } as any,
      {
        getActiveTenant: vi.fn(() => ({ id: 'tenant-1' })),
        activeTenant$,
      } as any,
      { success: vi.fn(), error: vi.fn() } as any,
      mockCdr as unknown as ChangeDetectorRef
    );
  });

  it('shows loading state before status resolves', async () => {
    let resolveStatus!: (value: unknown) => void;
    getIbcdCatalogStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve;
      })
    );

    component.ngOnInit();
    expect(component.statusLoading).toBe(true);

    resolveStatus({
      applied: true,
      ibcdCategoryCount: 2,
      ibcdVerseCount: 5,
    });
    await vi.waitFor(() => {
      expect(component.statusLoading).toBe(false);
    });
    expect(component.status?.applied).toBe(true);
  });

  it('clears status when tenant is removed', async () => {
    component.ngOnInit();
    await vi.waitFor(() => {
      expect(component.statusLoading).toBe(false);
    });

    activeTenant$.next(null);
    await vi.waitFor(() => {
      expect(component.activeTenantId).toBeNull();
      expect(component.status).toBeNull();
    });
  });

  it('ignores stale status when tenant changes before refresh completes', async () => {
    let resolveFirst!: (value: unknown) => void;
    getIbcdCatalogStatus
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      )
      .mockResolvedValueOnce({
        applied: true,
        ibcdCategoryCount: 9,
        ibcdVerseCount: 42,
      });

    component.ngOnInit();
    expect(component.statusLoading).toBe(true);

    activeTenant$.next({ id: 'tenant-2' });
    await vi.waitFor(() => {
      expect(component.activeTenantId).toBe('tenant-2');
    });

    resolveFirst({
      applied: true,
      ibcdCategoryCount: 1,
      ibcdVerseCount: 2,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(component.status?.ibcdVerseCount).toBe(42);
    expect(component.statusLoading).toBe(false);
  });

  it('applyCatalog shows success toast and refreshes status', async () => {
    const applyIbcdCatalog = vi.fn().mockResolvedValue({
      ok: true,
      categoriesAdded: 2,
      versesAdded: 5,
    });
    const toastSuccess = vi.fn();
    const catalogChanged = vi.fn();
    component = new IbcdMemorizationCatalogPanelComponent(
      { getIbcdCatalogStatus, applyIbcdCatalog, removeIbcdCatalog: vi.fn() } as any,
      {
        getActiveTenant: vi.fn(() => ({ id: 'tenant-1' })),
        activeTenant$,
      } as any,
      { success: toastSuccess, error: vi.fn() } as any,
      mockCdr as unknown as ChangeDetectorRef
    );
    component.catalogChanged.subscribe(catalogChanged);
    component.ngOnInit();
    await vi.waitFor(() => expect(component.statusLoading).toBe(false));

    await component.applyCatalog();

    expect(applyIbcdCatalog).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('IBCD catalog applied'));
    expect(catalogChanged).toHaveBeenCalled();
    expect(component.busy).toBe(false);
  });

  it('removeCatalog surfaces not_admin error', async () => {
    const removeIbcdCatalog = vi.fn().mockResolvedValue({ ok: false, reason: 'not_admin' });
    const toastError = vi.fn();
    component = new IbcdMemorizationCatalogPanelComponent(
      { getIbcdCatalogStatus, applyIbcdCatalog: vi.fn(), removeIbcdCatalog } as any,
      {
        getActiveTenant: vi.fn(() => ({ id: 'tenant-1' })),
        activeTenant$,
      } as any,
      { success: vi.fn(), error: toastError } as any,
      mockCdr as unknown as ChangeDetectorRef
    );
    component.ngOnInit();
    await vi.waitFor(() => expect(component.statusLoading).toBe(false));

    await component.removeCatalog();

    expect(toastError).toHaveBeenCalledWith(
      'You are not authorized to remove the IBCD catalog.'
    );
  });

  it('ignores identical tenant emissions and unsubscribes on destroy', async () => {
    component.ngOnInit();
    await vi.waitFor(() => expect(component.statusLoading).toBe(false));
    const callsBefore = getIbcdCatalogStatus.mock.calls.length;
    activeTenant$.next({ id: 'tenant-1' });
    expect(getIbcdCatalogStatus.mock.calls.length).toBe(callsBefore);
    component.ngOnDestroy();
    activeTenant$.next({ id: 'tenant-2' });
    expect(component.activeTenantId).toBe('tenant-1');
  });

  it('open/close confirm dialogs toggle flags', () => {
    component.openApplyConfirm();
    expect(component.showApplyConfirm).toBe(true);
    component.closeApplyConfirm();
    expect(component.showApplyConfirm).toBe(false);
    component.openRemoveConfirm();
    expect(component.showRemoveConfirm).toBe(true);
    component.closeRemoveConfirm();
    expect(component.showRemoveConfirm).toBe(false);
    expect(mockCdr.markForCheck).toHaveBeenCalled();
  });

  it('applyCatalog early-returns when busy and handles error reasons', async () => {
    const applyIbcdCatalog = vi.fn().mockResolvedValue({ ok: false, reason: 'no_tenant' });
    const toastError = vi.fn();
    component = new IbcdMemorizationCatalogPanelComponent(
      { getIbcdCatalogStatus, applyIbcdCatalog, removeIbcdCatalog: vi.fn() } as any,
      {
        getActiveTenant: vi.fn(() => ({ id: 'tenant-1' })),
        activeTenant$,
      } as any,
      { success: vi.fn(), error: toastError } as any,
      mockCdr as unknown as ChangeDetectorRef
    );
    component.busy = true;
    await component.applyCatalog();
    expect(applyIbcdCatalog).not.toHaveBeenCalled();

    component.busy = false;
    await component.applyCatalog();
    expect(toastError).toHaveBeenCalledWith('Select an organization first.');

    applyIbcdCatalog.mockResolvedValueOnce({ ok: false, reason: 'not_admin' });
    await component.applyCatalog();
    expect(toastError).toHaveBeenCalledWith(
      'You are not authorized to apply the IBCD catalog.'
    );

    applyIbcdCatalog.mockResolvedValueOnce({ ok: false, reason: 'db_error' });
    await component.applyCatalog();
    expect(toastError).toHaveBeenCalledWith('Could not apply the IBCD catalog.');
  });

  it('applyCatalog success with zero additions uses up-to-date message', async () => {
    const applyIbcdCatalog = vi.fn().mockResolvedValue({
      ok: true,
      categoriesAdded: 0,
      versesAdded: 0,
    });
    const toastSuccess = vi.fn();
    component = new IbcdMemorizationCatalogPanelComponent(
      { getIbcdCatalogStatus, applyIbcdCatalog, removeIbcdCatalog: vi.fn() } as any,
      {
        getActiveTenant: vi.fn(() => ({ id: 'tenant-1' })),
        activeTenant$,
      } as any,
      { success: toastSuccess, error: vi.fn() } as any,
      mockCdr as unknown as ChangeDetectorRef
    );
    await component.applyCatalog();
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('already up to date')
    );
  });

  it('removeCatalog success and other error reasons', async () => {
    const removeIbcdCatalog = vi.fn().mockResolvedValue({
      ok: true,
      removedVerses: 1,
      removedCategories: 1,
    });
    const toastSuccess = vi.fn();
    const toastError = vi.fn();
    const catalogChanged = vi.fn();
    component = new IbcdMemorizationCatalogPanelComponent(
      { getIbcdCatalogStatus, applyIbcdCatalog: vi.fn(), removeIbcdCatalog } as any,
      {
        getActiveTenant: vi.fn(() => ({ id: 'tenant-1' })),
        activeTenant$,
      } as any,
      { success: toastSuccess, error: toastError } as any,
      mockCdr as unknown as ChangeDetectorRef
    );
    component.catalogChanged.subscribe(catalogChanged);

    await component.removeCatalog();
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Removed 1 IBCD verse')
    );
    expect(catalogChanged).toHaveBeenCalled();

    component.busy = true;
    await component.removeCatalog();
    expect(removeIbcdCatalog).toHaveBeenCalledTimes(1);

    component.busy = false;
    removeIbcdCatalog.mockResolvedValueOnce({ ok: false, reason: 'no_tenant' });
    await component.removeCatalog();
    expect(toastError).toHaveBeenCalledWith('Select an organization first.');

    removeIbcdCatalog.mockResolvedValueOnce({ ok: false, reason: 'db_error' });
    await component.removeCatalog();
    expect(toastError).toHaveBeenCalledWith('Could not remove the IBCD catalog.');

    removeIbcdCatalog.mockResolvedValueOnce({
      ok: true,
      removedVerses: 2,
      removedCategories: 2,
    });
    await component.removeCatalog();
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('verses'));
  });

  it('refreshStatus returns early when tenant changes mid-flight', async () => {
    let resolveStatus!: (value: unknown) => void;
    getIbcdCatalogStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve;
      })
    );
    component.activeTenantId = 'tenant-1';
    const pending = component.refreshStatus();
    component.activeTenantId = 'tenant-2';
    resolveStatus({ applied: true, ibcdCategoryCount: 1, ibcdVerseCount: 1 });
    await pending;
    expect(component.status).toBeNull();
  });
});
