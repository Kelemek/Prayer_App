import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanningCenterListMapperComponent } from './planning-center-list-mapper.component';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { PlanningCenterListService } from '../../services/planning-center-list.service';
import { ChangeDetectorRef } from '@angular/core';

vi.mock('../../lib/planning-center', () => ({
  fetchPlanningCenterCredentialsStatus: vi.fn(),
  fetchPlanningCenterLists: vi.fn(),
}));

import {
  fetchPlanningCenterCredentialsStatus,
  fetchPlanningCenterLists,
} from '../../lib/planning-center';

describe('PlanningCenterListMapperComponent', () => {
  let component: PlanningCenterListMapperComponent;
  let supabaseFrom: ReturnType<typeof vi.fn>;
  let toast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };
  let planningCenterListService: { invalidateForUser: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    supabaseFrom = vi.fn();
    toast = { error: vi.fn(), success: vi.fn() };
    planningCenterListService = { invalidateForUser: vi.fn() };
    component = new PlanningCenterListMapperComponent(
      { client: { from: supabaseFrom } } as SupabaseService,
      toast as ToastService,
      planningCenterListService as PlanningCenterListService,
      { markForCheck: vi.fn() } as ChangeDetectorRef
    );
  });

  it('filters members by search text', () => {
    component.members = [
      { id: '1', name: 'Alice', email: 'alice@example.com' },
      { id: '2', name: 'Bob', email: 'bob@example.com' },
    ];
    component.memberSearch = 'bob';
    component.filterMembers();
    expect(component.filteredMembers).toHaveLength(1);
    expect(component.filteredMembers[0]?.email).toBe('bob@example.com');
  });

  it('builds mappings from members with list ids', () => {
    component.members = [
      {
        id: '1',
        name: 'Alice',
        email: 'alice@example.com',
        planning_center_list_id: 'list-1',
      },
    ];
    component.allLists = [{ id: 'list-1', name: 'Volunteers', description: '' }];
    component.loadMappings();
    expect(component.mappings[0]?.listName).toBe('Volunteers');
  });

  it('loads lists when Planning Center is disabled', async () => {
    component.activeTenantId = 'tenant-1';
    vi.mocked(fetchPlanningCenterCredentialsStatus).mockResolvedValue({
      status: { enabled: false },
      error: null,
    });
    await component.loadLists();
    expect(component.listsBlockedMessage).toContain('Enable Planning Center');
    expect(component.allLists).toEqual([]);
  });

  it('maps a list to a member and reloads members', async () => {
    component.activeTenantId = 'tenant-1';
    component.selectedMember = {
      id: 'm1',
      name: 'Alice',
      email: 'alice@example.com',
    };
    component.selectedList = { id: 'list-1', name: 'Volunteers', description: '' };

    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const updateChain = { update: vi.fn(() => ({ eq: updateEq })) };
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'm1',
            name: 'Alice',
            user_email: 'alice@example.com',
            planning_center_list_id: 'list-1',
          },
        ],
        error: null,
      }),
    };
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'tenant_memberships' && updateChain.update.mock.calls.length === 0) {
        return updateChain;
      }
      return selectChain;
    });

    await component.mapList();
    expect(toast.success).toHaveBeenCalledWith('List mapped');
    expect(planningCenterListService.invalidateForUser).toHaveBeenCalledWith('alice@example.com');
    expect(component.selectedMember).toBeNull();
  });

  it('selectMember and filterLists update picker state', () => {
    component.allLists = [{ id: 'l1', name: 'Staff Team', description: 'desc' }];
    component.filterLists();
    expect(component.filteredLists).toEqual([]);
    component.listSearch = 'staff';
    component.filterLists();
    expect(component.filteredLists[0]?.id).toBe('l1');

    component.selectMember({ id: 'm1', name: 'Alice', email: 'a@example.com' });
    expect(component.selectedMember?.id).toBe('m1');
    expect(component.memberSearch).toBe('Alice');
  });

  it('onExpandedChange loads data when expanded', async () => {
    component.activeTenantId = 'tenant-1';
    vi.mocked(fetchPlanningCenterCredentialsStatus).mockResolvedValue({
      status: { enabled: false },
      error: null,
    });
    await component.onExpandedChange(true);
    expect(component.sectionExpanded).toBe(true);
  });

  it('loads lists from Planning Center when enabled', async () => {
    component.activeTenantId = 'tenant-1';
    vi.mocked(fetchPlanningCenterCredentialsStatus).mockResolvedValue({
      status: { enabled: true },
      error: null,
    });
    vi.mocked(fetchPlanningCenterLists).mockResolvedValue({
      lists: [{ id: 'l1', name: 'Staff', description: '' }],
      error: null,
    });
    await component.loadLists();
    expect(component.allLists).toHaveLength(1);
  });

  it('surfaces errors when members fail to load', async () => {
    component.activeTenantId = 'tenant-1';
    supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
    });
    await component.loadMembers();
    expect(toast.error).toHaveBeenCalledWith('Failed to load members');
  });

  it('removeMapping clears planning center list id', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    supabaseFrom.mockReturnValue({
      update: vi.fn(() => ({ eq: updateEq })),
    });
    vi.spyOn(component, 'loadMembers').mockResolvedValue(undefined);
    await component.removeMapping('m1', 'alice@example.com');
    expect(toast.success).toHaveBeenCalledWith('Mapping removed');
    expect(planningCenterListService.invalidateForUser).toHaveBeenCalledWith(
      'alice@example.com'
    );
  });
});
