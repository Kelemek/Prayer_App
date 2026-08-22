import { withTenantId } from './prayer-tenant';
import type { PrayerStatus } from './prayer-types';

export type PersonalPrayerShareSource = {
  title: string;
  description: string;
  category?: string | null;
  prayer_for: string;
  user_email: string;
  personal_prayer_updates?: Array<{
    content: string;
    author: string;
    author_email?: string | null;
    created_at: string;
  }>;
};

export function requesterDisplayNameFromEmail(userEmail: string): string {
  const emailPart = userEmail.split('@')[0];
  return emailPart
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function resolveSharedPrayerRequesterName(
  sessionFullName: string | undefined,
  userEmail: string
): string {
  return sessionFullName || requesterDisplayNameFromEmail(userEmail);
}

export function sharedPersonalPrayerCommunityStatus(
  category: string | null | undefined
): PrayerStatus {
  return category === 'Answered' ? 'answered' : 'current';
}

export function buildSharedPersonalPrayerCommunityRow(
  personalPrayer: PersonalPrayerShareSource,
  requesterName: string,
  tenantId: string
): Record<string, unknown> {
  return withTenantId(
    {
      title: personalPrayer.title,
      description: personalPrayer.description,
      status: sharedPersonalPrayerCommunityStatus(personalPrayer.category),
      requester: requesterName,
      prayer_for: personalPrayer.prayer_for,
      email: personalPrayer.user_email,
      is_anonymous: false,
      approval_status: 'pending' as const,
      is_shared_personal_prayer: true,
    },
    tenantId
  );
}

export function buildSharedPersonalPrayerUpdateRows(
  personalPrayer: PersonalPrayerShareSource,
  communityPrayerId: string,
  tenantId: string
): Record<string, unknown>[] {
  return (personalPrayer.personal_prayer_updates || []).map((update) =>
    withTenantId(
      {
        prayer_id: communityPrayerId,
        content: update.content,
        author: update.author,
        author_email: update.author_email || null,
        is_anonymous: false,
        approval_status: 'pending' as const,
        created_at: update.created_at,
      },
      tenantId
    )
  );
}
