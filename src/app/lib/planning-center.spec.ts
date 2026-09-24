import { describe, it, expect, vi } from 'vitest';
import { formatPersonName, resolvePlanningCenterMemberAvatarUrl } from './planning-center';
import type { PlanningCenterPerson } from './planning-center';

describe('resolvePlanningCenterMemberAvatarUrl', () => {
  it('prefers demographic_avatar_url over avatar UUID', () => {
    expect(
      resolvePlanningCenterMemberAvatarUrl({
        avatar: 'us1-deadbeef-dead-beef-dead-beefdeadbeef',
        demographic_avatar_url:
          'https://avatars.planningcenteronline.com/uploads/person/1-abc/avatar.2.jpg',
      })
    ).toBe(
      'https://avatars.planningcenteronline.com/uploads/person/1-abc/avatar.2.jpg'
    );
  });

  it('uses http avatar when demographic is missing', () => {
    expect(
      resolvePlanningCenterMemberAvatarUrl({
        avatar: 'https://cdn.example.com/photo.jpg',
      })
    ).toBe('https://cdn.example.com/photo.jpg');
  });

  it('returns null for file UUID only', () => {
    expect(
      resolvePlanningCenterMemberAvatarUrl({
        avatar: 'us1-deadbeef-dead-beef-dead-beefdeadbeef',
      })
    ).toBeNull();
  });
});

describe('formatPersonName', () => {
  it('uses attributes.name when present', () => {
    const person: PlanningCenterPerson = {
      id: '1',
      type: 'Person',
      attributes: { name: 'Jane Doe', first_name: 'Jane', last_name: 'Doe' },
    };
    expect(formatPersonName(person)).toBe('Jane Doe');
  });

  it('falls back to first/last name or Unknown', () => {
    expect(
      formatPersonName({
        id: '2',
        type: 'Person',
        attributes: { name: '  ', first_name: 'A', last_name: 'B' },
      })
    ).toBe('A B');
    expect(
      formatPersonName({
        id: '3',
        type: 'Person',
        attributes: { name: '' },
      })
    ).toBe('Unknown');
  });
});

describe('planning-center invoke', () => {
  it('lookupPersonByEmail rejects empty search', async () => {
    const { lookupPersonByEmail } = await import('./planning-center');
    const result = await lookupPersonByEmail({ functions: { invoke: vi.fn() } } as never, 't', '  ');
    expect(result.error).toBe('Email address is required');
  });

  it('fetchListMembers sorts by last name', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        members: [{ id: '1', name: 'Zoe Adams' }, { id: '2', name: 'Bob Smith' }],
      },
      error: null,
    });
    const { fetchListMembers } = await import('./planning-center');
    const { members } = await fetchListMembers(
      { functions: { invoke } } as never,
      'tenant',
      'list'
    );
    expect(members.map((m) => m.name)).toEqual(['Zoe Adams', 'Bob Smith']);
  });

  it('fetchPlanningCenterCredentialsStatus maps status payload', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { enabled: true, configured: false, app_id_last4: 'abcd' },
      error: null,
    });
    const { fetchPlanningCenterCredentialsStatus } = await import('./planning-center');
    const { status, error } = await fetchPlanningCenterCredentialsStatus(
      { functions: { invoke } } as never,
      'tenant-1'
    );
    expect(error).toBeNull();
    expect(status).toEqual({
      enabled: true,
      configured: false,
      app_id_last4: 'abcd',
    });
  });

  it('returns invoke body errors from list fetch', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { error: 'PCO unavailable' },
      error: null,
    });
    const { fetchPlanningCenterLists } = await import('./planning-center');
    const { lists, error } = await fetchPlanningCenterLists(
      { functions: { invoke } } as never,
      'tenant-1'
    );
    expect(lists).toEqual([]);
    expect(error).toBe('PCO unavailable');
  });

  it('sorts list members by last name including suffixes', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        members: [
          { id: '1', name: 'John Smith Jr.' },
          { id: '2', name: 'Amy Adams' },
        ],
      },
      error: null,
    });
    const { fetchListMembers } = await import('./planning-center');
    const { members } = await fetchListMembers(
      { functions: { invoke } } as never,
      'tenant',
      'list'
    );
    expect(members.map((m) => m.name)).toEqual(['Amy Adams', 'John Smith Jr.']);
  });

  it('savePlanningCenterCredentials surfaces body errors', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { error: 'invalid secret' },
      error: null,
    });
    const { savePlanningCenterCredentials } = await import('./planning-center');
    const { error } = await savePlanningCenterCredentials(
      { functions: { invoke } } as never,
      'tenant-1',
      'app',
      'secret'
    );
    expect(error).toBe('invalid secret');
  });

  it('testPlanningCenterCredentials returns ok when invoke succeeds', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    const { testPlanningCenterCredentials } = await import('./planning-center');
    const result = await testPlanningCenterCredentials(
      { functions: { invoke } } as never,
      'tenant-1'
    );
    expect(result).toEqual({ ok: true, error: null });
  });

  it('passes tenant_id to lookup invoke', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { people: [], count: 0 },
      error: null,
    });
    const client = { functions: { invoke } } as never;
    const { lookupPersonByEmail } = await import('./planning-center');
    await lookupPersonByEmail(client, 'tenant-uuid', 'jane@example.com');
    expect(invoke).toHaveBeenCalledWith('planning-center-lookup', {
      body: { tenant_id: 'tenant-uuid', email: 'jane@example.com' },
    });
  });
});
