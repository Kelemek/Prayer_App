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
