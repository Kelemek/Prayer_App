import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrayerGroupService } from "./prayer-group.service";
import type { PrayerRequest } from "../lib/prayer-types";
import { groupPrayersCacheKey } from "../lib/prayer-tenant";

function createService() {
  const rpc = vi.fn();
  const from = vi.fn();
  const client = { rpc, from };
  const supabase = { client };
  const authIdentity = { getEmail: vi.fn().mockResolvedValue("owner@example.com") };
  const connectivity = {
    requireOnline: vi.fn(() => true),
    isOnline: vi.fn(() => true),
  };
  const toast = {
    success: vi.fn(),
    error: vi.fn(),
  };
  const userSession = {
    getCurrentSession: vi.fn(() => ({ fullName: "Owner" })),
  };
  const emailNotification = {
    sendGroupInvitation: vi.fn(),
    notifyGroupPrayerAdded: vi.fn().mockResolvedValue(undefined),
    notifyGroupPrayerUpdate: vi.fn().mockResolvedValue(undefined),
  };
  const cache = {
    get: vi.fn(() => null),
    getStale: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  };

  const service = new PrayerGroupService(
    supabase as any,
    authIdentity as any,
    connectivity as any,
    toast as any,
    userSession as any,
    emailNotification as any,
    cache as any
  );

  return { service, rpc, from, toast, connectivity, cache, emailNotification };
}

const cachedPrayer: PrayerRequest = {
  id: "p1",
  title: "Cached prayer",
  description: "",
  status: "current",
  prayer_for: "Someone",
  requester: "Owner",
  email: "owner@example.com",
  is_anonymous: false,
  date_requested: "2026-01-01T00:00:00Z",
  date_answered: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  approval_status: "approved",
  type: "prayer",
  updates: [],
  prayed_for_count: 0,
  group_id: "g1",
};

describe("PrayerGroupService group management", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loadMyGroups returns groups sorted by display_order ascending", async () => {
    const { service, from, rpc } = createService();
    rpc.mockResolvedValue({ data: true, error: null });

    const memberships = [
      { group_id: "g-newer", role: "owner", is_active: true, display_order: 1 },
      { group_id: "g-older", role: "member", is_active: true, display_order: 0 },
    ];
    const groups = [
      {
        id: "g-newer",
        name: "Newer",
        created_by_email: "owner@example.com",
        created_at: "2026-02-01T00:00:00Z",
        updated_at: "2026-02-01T00:00:00Z",
      },
      {
        id: "g-older",
        name: "Older",
        created_by_email: "owner@example.com",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    const membershipEqActive = vi.fn().mockResolvedValue({ data: memberships, error: null });
    const membershipEqEmail = vi.fn().mockReturnValue({ eq: membershipEqActive });
    const membershipSelect = vi.fn().mockReturnValue({ eq: membershipEqEmail });

    const groupsIn = vi.fn().mockResolvedValue({ data: groups, error: null });
    const groupsSelect = vi.fn().mockReturnValue({ in: groupsIn });

    from.mockImplementation((table: string) => {
      if (table === "prayer_group_members") {
        return { select: membershipSelect };
      }
      if (table === "prayer_groups") {
        return { select: groupsSelect };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await service.loadMyGroups();

    expect(result.map((group) => group.id)).toEqual(["g-older", "g-newer"]);
    expect(service.getGroups().map((group) => group.id)).toEqual(["g-older", "g-newer"]);
  });

  it("reorderGroups optimistically updates order and calls RPC", async () => {
    const { service, rpc } = createService();
    const older = {
      id: "g-older",
      name: "Older",
      created_by_email: "owner@example.com",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      my_role: "owner" as const,
    };
    const newer = {
      id: "g-newer",
      name: "Newer",
      created_by_email: "owner@example.com",
      created_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-02-01T00:00:00Z",
      my_role: "member" as const,
    };
    (service as any).groupsSubject.next([older, newer]);
    rpc.mockResolvedValue({ error: null });

    const ok = await service.reorderGroups(["g-newer", "g-older"]);

    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("reorder_prayer_groups", {
      p_ordered_group_ids: ["g-newer", "g-older"],
    });
    expect(service.getGroups().map((group) => group.id)).toEqual([
      "g-newer",
      "g-older",
    ]);
  });

  it("reorderGroups reloads groups on RPC failure", async () => {
    const { service, rpc, from } = createService();
    const older = {
      id: "g-older",
      name: "Older",
      created_by_email: "owner@example.com",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      my_role: "owner" as const,
    };
    const newer = {
      id: "g-newer",
      name: "Newer",
      created_by_email: "owner@example.com",
      created_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-02-01T00:00:00Z",
      my_role: "member" as const,
    };
    (service as any).groupsSubject.next([older, newer]);

    rpc
      .mockResolvedValueOnce({ error: { message: "boom" } })
      .mockResolvedValueOnce({ data: true, error: null });

    const memberships = [
      { group_id: "g-older", role: "owner", is_active: true, display_order: 0 },
      { group_id: "g-newer", role: "member", is_active: true, display_order: 1 },
    ];
    const groups = [
      {
        id: "g-older",
        name: "Older",
        created_by_email: "owner@example.com",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "g-newer",
        name: "Newer",
        created_by_email: "owner@example.com",
        created_at: "2026-02-01T00:00:00Z",
        updated_at: "2026-02-01T00:00:00Z",
      },
    ];
    const membershipEqActive = vi.fn().mockResolvedValue({ data: memberships, error: null });
    const membershipEqEmail = vi.fn().mockReturnValue({ eq: membershipEqActive });
    const membershipSelect = vi.fn().mockReturnValue({ eq: membershipEqEmail });
    const groupsIn = vi.fn().mockResolvedValue({ data: groups, error: null });
    const groupsSelect = vi.fn().mockReturnValue({ in: groupsIn });
    from.mockImplementation((table: string) => {
      if (table === "prayer_group_members") {
        return { select: membershipSelect };
      }
      if (table === "prayer_groups") {
        return { select: groupsSelect };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const ok = await service.reorderGroups(["g-newer", "g-older"]);

    expect(ok).toBe(false);
    expect(service.getGroups().map((group) => group.id)).toEqual([
      "g-older",
      "g-newer",
    ]);
  });

  it("removeMember calls remove_prayer_group_member", async () => {
    const { service, rpc, toast } = createService();
    rpc.mockResolvedValue({ error: null });

    const ok = await service.removeMember("g1", "member@example.com");

    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("remove_prayer_group_member", {
      p_group_id: "g1",
      p_email: "member@example.com",
    });
    expect(toast.success).toHaveBeenCalledWith("Member removed");
  });

  it("loadGroupMembers returns active members", async () => {
    const { service, from } = createService();
    const members = [
      {
        id: "m1",
        group_id: "g1",
        user_email: "owner@example.com",
        role: "owner",
        is_active: true,
      },
    ];
    const order = vi.fn().mockReturnThis();
    const eqActive = vi.fn().mockReturnThis();
    const eqGroup = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnValue({
      eq: eqGroup,
    });
    eqGroup.mockReturnValue({
      eq: eqActive,
    });
    eqActive.mockReturnValue({
      order,
    });
    order.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({ data: members, error: null }),
    });
    from.mockReturnValue({ select });

    const result = await service.loadGroupMembers("g1");

    expect(from).toHaveBeenCalledWith("prayer_group_members");
    expect(result).toEqual(members);
  });

  it('addGroupPrayer notifies other group members after insert', async () => {
    const { service, from, emailNotification } = createService();
    (service as any).groupsSubject.next([
      {
        id: 'g1',
        name: 'Family',
        created_by_email: 'owner@example.com',
        created_from_tenant_id: 'tenant-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        my_role: 'owner',
      },
    ]);

    const members = [
      {
        id: 'm1',
        group_id: 'g1',
        user_email: 'owner@example.com',
        role: 'owner',
        is_active: true,
      },
      {
        id: 'm2',
        group_id: 'g1',
        user_email: 'member@example.com',
        role: 'member',
        is_active: true,
      },
    ];

    const insertSingle = vi.fn().mockResolvedValue({ data: { id: 'p-new' }, error: null });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const order = vi.fn().mockReturnThis();
    const eqActive = vi.fn().mockReturnThis();
    const eqGroup = vi.fn().mockReturnThis();
    const membersSelect = vi.fn().mockReturnValue({ eq: eqGroup });
    eqGroup.mockReturnValue({ eq: eqActive });
    eqActive.mockReturnValue({ order });
    order.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({ data: members, error: null }),
    });

    const prayersOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const prayersIn = vi.fn().mockReturnValue({ order: prayersOrder });
    const prayersSelect = vi.fn().mockReturnValue({ in: prayersIn });

    from.mockImplementation((table: string) => {
      if (table === 'group_prayers') {
        return { insert, select: prayersSelect };
      }
      if (table === 'prayer_group_members') {
        return { select: membersSelect };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const ok = await service.addGroupPrayer('g1', {
      title: 'Pray',
      description: 'Details',
      prayer_for: 'Friend',
      requester: 'Owner',
      email: 'owner@example.com',
      is_anonymous: false,
    });

    await vi.waitFor(() => {
      expect(emailNotification.notifyGroupPrayerAdded).toHaveBeenCalled();
    });

    expect(ok).toBe(true);
    expect(emailNotification.notifyGroupPrayerAdded).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'g1',
        prayerId: 'p-new',
        authorEmail: 'owner@example.com',
        memberEmails: ['owner@example.com', 'member@example.com'],
        tenantId: 'tenant-1',
      })
    );
  });
});

describe("PrayerGroupService group prayers cache", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows cached group prayers immediately without loading state", async () => {
    const { service, cache, from } = createService();
    const loadingStates: boolean[] = [];
    service.loadingPrayers$.subscribe((loading) => loadingStates.push(loading));
    cache.get.mockImplementation((key: string) =>
      key === groupPrayersCacheKey("g1") ? [cachedPrayer] : null
    );

    const prayers = await service.loadGroupPrayers("g1", true);

    expect(prayers).toEqual([cachedPrayer]);
    expect(service.getGroupPrayers()).toEqual([cachedPrayer]);
    expect(loadingStates).not.toContain(true);
    expect(from).not.toHaveBeenCalled();
  });

  it("clears stale group prayers when switching to an uncached group", async () => {
    const { service, cache, from } = createService();
    (service as any).activeGroupId = "g1";
    (service as any).prayersSubject.next([cachedPrayer]);
    cache.get.mockReturnValue(null);
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const inIds = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ in: inIds });
    from.mockReturnValue({ select });

    await service.loadGroupPrayers("g2");

    expect(service.getGroupPrayers()).toEqual([]);
  });

  it("caches prayers after a successful fetch", async () => {
    const { service, cache, from } = createService();
    const row = {
      id: "p1",
      group_id: "g1",
      title: "Fresh prayer",
      description: null,
      prayer_for: "Someone",
      status: "current",
      requester: "Owner",
      email: "owner@example.com",
      is_anonymous: false,
      date_requested: "2026-01-01T00:00:00Z",
      date_answered: null,
      prayed_for_count: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      group_prayer_updates: [],
    };
    const order = vi.fn().mockResolvedValue({ data: [row], error: null });
    const inIds = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ in: inIds });
    from.mockReturnValue({ select });

    await service.loadGroupPrayers("g1");

    expect(cache.set).toHaveBeenCalledWith(
      groupPrayersCacheKey("g1"),
      expect.arrayContaining([
        expect.objectContaining({ id: "p1", title: "Fresh prayer" }),
      ]),
      20 * 60 * 1000
    );
  });

  it("uses stale cache when offline", async () => {
    const { service, cache, connectivity, from } = createService();
    connectivity.isOnline.mockReturnValue(false);
    cache.get.mockReturnValue(null);
    cache.getStale.mockImplementation((key: string) =>
      key === groupPrayersCacheKey("g1") ? [cachedPrayer] : null
    );

    const prayers = await service.loadGroupPrayers("g1");

    expect(prayers).toEqual([cachedPrayer]);
    expect(from).not.toHaveBeenCalled();
  });

  const familyGroup = {
    id: "g1",
    name: "Family",
    created_by_email: "owner@example.com",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("hydrateGroupPrayers caches uncached groups without showing loading", async () => {
    const { service, cache, from } = createService();
    const loadingStates: boolean[] = [];
    service.loadingPrayers$.subscribe((loading) => loadingStates.push(loading));
    (service as any).prayersSubject.next([cachedPrayer]);
    (service as any).groupsSubject.next([
      { ...familyGroup, id: "g2" },
      { ...familyGroup, id: "g3" },
    ]);

    const rows = [
      {
        id: "p-g2",
        group_id: "g2",
        title: "Group two",
        description: null,
        prayer_for: "Someone",
        status: "current",
        requester: "Owner",
        email: "owner@example.com",
        is_anonymous: false,
        date_requested: "2026-01-01T00:00:00Z",
        date_answered: null,
        prayed_for_count: 0,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        group_prayer_updates: [],
      },
    ];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const inIds = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ in: inIds });
    from.mockReturnValue({ select });

    await service.hydrateGroupPrayers({ force: false });

    expect(inIds).toHaveBeenCalledWith("group_id", ["g2", "g3"]);
    expect(cache.set).toHaveBeenCalledWith(
      groupPrayersCacheKey("g2"),
      expect.arrayContaining([
        expect.objectContaining({ id: "p-g2", title: "Group two" }),
      ]),
      20 * 60 * 1000
    );
    expect(cache.set).toHaveBeenCalledWith(
      groupPrayersCacheKey("g3"),
      [],
      20 * 60 * 1000
    );
    expect(service.getGroupPrayers()).toEqual([cachedPrayer]);
    expect(loadingStates).not.toContain(true);
  });

  it("hydrateGroupPrayers publishes the focused group from cache without refetching it", async () => {
    const { service, cache, from } = createService();
    (service as any).groupsSubject.next([
      familyGroup,
      { ...familyGroup, id: "g2" },
    ]);
    cache.get.mockImplementation((key: string) =>
      key === groupPrayersCacheKey("g1") ? [cachedPrayer] : null
    );
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const inIds = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ in: inIds });
    from.mockReturnValue({ select });

    await service.hydrateGroupPrayers({ force: false, focusGroupId: "g1" });

    expect(inIds).toHaveBeenCalledWith("group_id", ["g2"]);
    expect(service.getGroupPrayers()).toEqual([cachedPrayer]);
  });

  it("hydrateGroupPrayers skips groups that are already cached unless forced", async () => {
    const { service, cache, from } = createService();
    (service as any).groupsSubject.next([familyGroup]);
    cache.get.mockImplementation((key: string) =>
      key === groupPrayersCacheKey("g1") ? [cachedPrayer] : null
    );
    const loadMyGroups = vi.spyOn(service, "loadMyGroups");

    await service.hydrateGroupPrayers({ force: false });

    expect(loadMyGroups).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("hydrateGroupPrayers force refetches cached groups and updates the active group", async () => {
    const { service, cache, from } = createService();
    const loadingStates: boolean[] = [];
    service.loadingPrayers$.subscribe((loading) => loadingStates.push(loading));
    (service as any).activeGroupId = "g1";
    (service as any).prayersSubject.next([cachedPrayer]);
    cache.get.mockImplementation((key: string) =>
      key === groupPrayersCacheKey("g1") ? [cachedPrayer] : null
    );
    vi.spyOn(service, "loadMyGroups").mockResolvedValue([familyGroup]);

    const row = {
      id: "p-fresh",
      group_id: "g1",
      title: "Fresh after refresh",
      description: null,
      prayer_for: "Someone",
      status: "current",
      requester: "Owner",
      email: "owner@example.com",
      is_anonymous: false,
      date_requested: "2026-01-02T00:00:00Z",
      date_answered: null,
      prayed_for_count: 1,
      created_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      group_prayer_updates: [],
    };
    const order = vi.fn().mockResolvedValue({ data: [row], error: null });
    const inIds = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ in: inIds });
    from.mockReturnValue({ select });

    await service.hydrateGroupPrayers({ force: true });

    expect(inIds).toHaveBeenCalledWith("group_id", ["g1"]);
    expect(cache.set).toHaveBeenCalledWith(
      groupPrayersCacheKey("g1"),
      expect.arrayContaining([
        expect.objectContaining({ id: "p-fresh", title: "Fresh after refresh" }),
      ]),
      20 * 60 * 1000
    );
    expect(service.getGroupPrayers()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "p-fresh", title: "Fresh after refresh" }),
      ])
    );
    expect(loadingStates).not.toContain(true);
  });

  it("hydrateGroupPrayers swallows fetch errors without throwing", async () => {
    const { service, from } = createService();
    vi.spyOn(service, "loadMyGroups").mockResolvedValue([familyGroup]);
    const order = vi.fn().mockRejectedValue(new Error("network fail"));
    const inIds = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ in: inIds });
    from.mockReturnValue({ select });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(service.hydrateGroupPrayers({ force: true })).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("hydrateGroupPrayers does nothing when offline", async () => {
    const { service, connectivity, from, cache } = createService();
    connectivity.isOnline.mockReturnValue(false);
    const loadMyGroups = vi.spyOn(service, "loadMyGroups");

    await service.hydrateGroupPrayers({ force: true });

    expect(loadMyGroups).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("resume hydrates cached-gap groups after debounce", async () => {
    vi.useFakeTimers();
    const { service } = createService();
    const hydrate = vi.spyOn(service, "hydrateGroupPrayers").mockResolvedValue();
    Object.defineProperty(document, "hidden", { value: false, configurable: true });

    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(400);

    expect(hydrate).toHaveBeenCalledWith({ force: false });
    vi.useRealTimers();
  });
});
