import { describe, expect, it } from 'vitest';
import {
  buildSharedPersonalPrayerCommunityRow,
  buildSharedPersonalPrayerUpdateRows,
  resolveSharedPrayerRequesterName,
  sharedPersonalPrayerCommunityStatus,
} from './prayer-personal-share';

describe('prayer-personal-share', () => {
  it('resolves requester name from session or email', () => {
    expect(resolveSharedPrayerRequesterName('Jane Doe', 'a@b.com')).toBe('Jane Doe');
    expect(resolveSharedPrayerRequesterName(undefined, 'jane.doe@b.com')).toBe(
      'Jane Doe'
    );
  });

  it('maps answered personal category to community status', () => {
    expect(sharedPersonalPrayerCommunityStatus('Answered')).toBe('answered');
    expect(sharedPersonalPrayerCommunityStatus('Family')).toBe('current');
  });

  it('builds a tenant-scoped shared community prayer row', () => {
    expect(
      buildSharedPersonalPrayerCommunityRow(
        {
          title: 'Pray',
          description: 'Desc',
          category: 'Family',
          prayer_for: 'John',
          user_email: 'jane@example.com',
        },
        'Jane Doe',
        'tenant-1'
      )
    ).toMatchObject({
      tenant_id: 'tenant-1',
      approval_status: 'pending',
      is_shared_personal_prayer: true,
      requester: 'Jane Doe',
      status: 'current',
    });
  });

  it('copies updates onto the new community prayer with tenant_id', () => {
    const rows = buildSharedPersonalPrayerUpdateRows(
      {
        title: 'Pray',
        description: 'Desc',
        prayer_for: 'John',
        user_email: 'jane@example.com',
        personal_prayer_updates: [
          {
            content: 'Update',
            author: 'Jane',
            author_email: 'jane@example.com',
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      'community-1',
      'tenant-1'
    );
    expect(rows).toEqual([
      expect.objectContaining({
        prayer_id: 'community-1',
        tenant_id: 'tenant-1',
        approval_status: 'pending',
        content: 'Update',
      }),
    ]);
  });
});
