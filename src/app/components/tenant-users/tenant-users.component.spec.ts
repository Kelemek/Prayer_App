import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TenantUsersComponent } from './tenant-users.component';
import { TenantManagementService } from '../../services/tenant-management.service';
import { ToastService } from '../../services/toast.service';
import type { TenantUserDirectoryRow } from '../../types/tenant';

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const path = join(componentDir, url);
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8');
  }
  throw new Error(`Component resource not found: ${url}`);
}

const stackedUser: TenantUserDirectoryRow = {
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  tenants: [
    { id: 't-alpha', name: 'Alpha Church' },
    { id: 't-beta', name: 'Beta Church' },
  ],
  groups: [
    { id: 'g-elders', name: 'Elders' },
    { id: 'g-youth', name: 'Youth' },
  ],
};

const groupOnlyUser: TenantUserDirectoryRow = {
  email: 'pat@example.com',
  name: 'Pat Group',
  tenants: [],
  groups: [{ id: 'g-family', name: 'Family' }],
};

describe('TenantUsersComponent', () => {
  beforeAll(async () => {
    await resolveComponentResources((url) => Promise.resolve(readComponentResource(url)));
  });

  let fixture: ComponentFixture<TenantUsersComponent>;
  let listUsers: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listUsers = vi.fn().mockResolvedValue([stackedUser, groupOnlyUser]);
    await TestBed.configureTestingModule({
      imports: [TenantUsersComponent],
      providers: [
        { provide: TenantManagementService, useValue: { listUsersWithTenantsAndGroups: listUsers } },
        { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantUsersComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('loads a user with stacked tenant and group names on expand', async () => {
    const component = fixture.componentInstance;
    await component.onExpandedChange(true);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listUsers).toHaveBeenCalledTimes(1);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('ada@example.com');
    expect(text).toContain('Alpha Church');
    expect(text).toContain('Beta Church');
    expect(text).toContain('Elders');
    expect(text).toContain('Youth');

    const adaRow = Array.from(
      fixture.nativeElement.querySelectorAll('div.grid.gap-2') as NodeListOf<HTMLElement>
    ).find((row) => row.textContent?.includes('ada@example.com'));
    expect(adaRow).toBeTruthy();
    expect(adaRow?.textContent).toContain('Alpha Church');
    expect(adaRow?.textContent).toContain('Beta Church');
    expect(adaRow?.textContent).toContain('Elders');
    expect(adaRow?.textContent).toContain('Youth');
  });

  it('sorts users and paginates results', async () => {
    const component = fixture.componentInstance;
    await component.onExpandedChange(true);
    await fixture.whenStable();
    component.toggleSort('email');
    expect(component.sortBy).toBe('email');
    component.pageSize = 1;
    component.loadPageData();
    expect(component.users).toHaveLength(1);
    component.nextPage();
    expect(component.currentPage).toBe(2);
    expect(component.getSortIndicator('email')).toContain('↑');
  });

  it('shows an error when user load fails', async () => {
    listUsers.mockRejectedValue(new Error('network down'));
    const toast = TestBed.inject(ToastService) as { error: ReturnType<typeof vi.fn> };
    const component = fixture.componentInstance;
    await component.onExpandedChange(true);
    await fixture.whenStable();
    expect(component.error).toBe('network down');
    expect(toast.error).toHaveBeenCalledWith('network down');
  });

  it('debounces short search queries', async () => {
    vi.useFakeTimers();
    const component = fixture.componentInstance;
    await component.onExpandedChange(true);
    await fixture.whenStable();
    component.onListSearchQueryChange('a');
    expect(component.users).toHaveLength(2);
    vi.useRealTimers();
  });

  it('clears debounced search on destroy', async () => {
    vi.useFakeTimers();
    const component = fixture.componentInstance;
    await component.onExpandedChange(true);
    await fixture.whenStable();
    component.onListSearchQueryChange('');
    component.ngOnDestroy();
    vi.runAllTimers();
    vi.useRealTimers();
    expect((component as { listSearchDebounceTimer: unknown }).listSearchDebounceTimer).toBeNull();
  });

  it('flushes search on Enter and clears list search', async () => {
    const component = fixture.componentInstance;
    await component.onExpandedChange(true);
    await fixture.whenStable();
    component.searchQuery = 'Alpha';
    component.onListSearchKeydown({ key: 'Enter', preventDefault: vi.fn() } as KeyboardEvent);
    expect(component.users).toHaveLength(1);
    component.clearListSearch();
    expect(component.searchQuery).toBe('');
    expect(component.users).toHaveLength(2);
  });

  it('toggles sort direction and navigates pagination', async () => {
    const component = fixture.componentInstance;
    await component.onExpandedChange(true);
    await fixture.whenStable();
    component.toggleSort('name');
    expect(component.sortDirection).toBe('desc');
    expect(component.getSortIndicator('name')).toContain('↓');
    component.pageSize = 1;
    component.applyFilters();
    expect(component.getPaginationRange().length).toBeGreaterThan(1);
    component.goToPage(2);
    expect(component.currentPage).toBe(2);
    component.previousPage();
    expect(component.currentPage).toBe(1);
    component.onPageSizeChange('50');
    expect(component.pageSize).toBe(50);
    expect(component.isFirstPage).toBe(true);
    expect(component.isLastPage).toBe(true);
  });

  it('filters users by tenant name', async () => {
    const component = fixture.componentInstance;
    await component.onExpandedChange(true);
    await fixture.whenStable();
    fixture.detectChanges();

    component.searchQuery = 'Alpha';
    component.flushListSearchNow();
    fixture.detectChanges();

    expect(component.users).toHaveLength(1);
    expect(component.users[0].email).toBe('ada@example.com');
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
    expect(fixture.nativeElement.textContent).not.toContain('Pat Group');
  });
});
