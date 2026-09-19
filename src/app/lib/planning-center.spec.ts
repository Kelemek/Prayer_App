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
});

describe('planning-center invoke', () => {
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
