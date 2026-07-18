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
});
