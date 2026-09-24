import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { HomePlanningCenterController } from './home-planning-center.controller';

describe('HomePlanningCenterController', () => {
  let controller: HomePlanningCenterController;
  let listId$: BehaviorSubject<string | null>;
  let members$: BehaviorSubject<Array<{ id: string; name: string }>>;
  let loading$: BehaviorSubject<boolean>;
  let host: {
    markForCheck: ReturnType<typeof vi.fn>;
    detectChanges: ReturnType<typeof vi.fn>;
    onListStateChanged: ReturnType<typeof vi.fn>;
    onMemberPrayersLoaded: ReturnType<typeof vi.fn>;
    retryPendingPrayerDeepLink: ReturnType<typeof vi.fn>;
  };
  let prayerService: {
    getMemberPrayerUpdatesBatch: ReturnType<typeof vi.fn>;
    getMemberPrayedForCountsBatch: ReturnType<typeof vi.fn>;
    getMemberPrayerUpdates: ReturnType<typeof vi.fn>;
  };
  const destroy$ = new Subject<void>();

  beforeEach(() => {
    controller = new HomePlanningCenterController();
    listId$ = new BehaviorSubject<string | null>(null);
    members$ = new BehaviorSubject<Array<{ id: string; name: string }>>([]);
    loading$ = new BehaviorSubject(false);
    host = {
      markForCheck: vi.fn(),
      detectChanges: vi.fn(),
      onListStateChanged: vi.fn(),
      onMemberPrayersLoaded: vi.fn(),
      retryPendingPrayerDeepLink: vi.fn(),
    };
    prayerService = {
      getMemberPrayerUpdatesBatch: vi.fn().mockResolvedValue({ m1: [] }),
      getMemberPrayedForCountsBatch: vi.fn().mockResolvedValue({ m1: 2 }),
      getMemberPrayerUpdates: vi.fn().mockResolvedValue([{ id: 'u1' }]),
    };
    controller.bindHost(host, {
      planningCenterListService: {
        listId$,
        members$,
        loading$,
        loadForCurrentUser: vi.fn(),
        loadForUser: vi.fn(),
      } as never,
      prayerService: prayerService as never,
    });
    controller.subscribe(destroy$);
  });

  it('showPlanningCenterMembersFilter reflects list id', () => {
    expect(controller.showPlanningCenterMembersFilter).toBe(false);
    listId$.next('list-1');
    expect(controller.showPlanningCenterMembersFilter).toBe(true);
  });

  it('planningCenterMembersDisplayCount shows ellipsis while loading', () => {
    loading$.next(true);
    expect(controller.planningCenterMembersDisplayCount).toBe('…');
    members$.next([{ id: 'm1', name: 'A' }]);
    loading$.next(false);
    expect(controller.planningCenterMembersDisplayCount).toBe('1');
  });

  it('loads member prayers when list and members are set', async () => {
    controller.planningCenterListId = 'list-1';
    controller.planningCenterListMembers = [{ id: 'm1', name: 'Member' }];
    await controller.loadMemberPrayers();
    expect(controller.filteredPlanningCenterPrayers[0]?.id).toBe('pc-member-m1');
    expect(host.onMemberPrayersLoaded).toHaveBeenCalled();
  });

  it('reloadMemberPrayerUpdates patches a member card', async () => {
    controller.planningCenterListId = 'list-1';
    controller.planningCenterListMembers = [{ id: 'm1', name: 'Member' }];
    await controller.loadMemberPrayers();
    await controller.reloadMemberPrayerUpdates('m1');
    expect(controller.filteredPlanningCenterPrayers[0]?.updates).toEqual([{ id: 'u1' }]);
  });

  it('delegates loadForCurrentUser to list service', () => {
    const loadForCurrentUser = vi.fn();
    controller.bindHost(host, {
      planningCenterListService: {
        listId$,
        members$,
        loading$,
        loadForCurrentUser,
        loadForUser: vi.fn(),
      } as never,
      prayerService: prayerService as never,
    });
    controller.loadForCurrentUser(true);
    expect(loadForCurrentUser).toHaveBeenCalledWith(true);
  });
});
