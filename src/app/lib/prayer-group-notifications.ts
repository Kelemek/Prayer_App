import type { SupabaseService } from '../services/supabase.service';
import type { EmailNotificationService } from '../services/email-notification.service';
import type { PrayerGroup, PrayerGroupMember } from '../types/prayer-group';
import type { PrayerRequest } from './prayer-types';
import type { PrayerFormSubmitPayload } from './prayer-form-submit';

export async function resolveGroupNotificationContext(
  supabase: SupabaseService,
  group: PrayerGroup,
  loadMembers: (groupId: string) => Promise<PrayerGroupMember[]>
): Promise<{ group: PrayerGroup; memberEmails: string[]; tenantId: string | null } | null> {
  let tenantId = group.created_from_tenant_id ?? null;
  if (!tenantId) {
    const { data } = await supabase.client
      .from('tenants')
      .select('id')
      .eq('slug', 'default-tenant')
      .maybeSingle();
    tenantId = data?.id ?? null;
  }

  const members = await loadMembers(group.id);
  return {
    group,
    memberEmails: members.map((member) => member.user_email),
    tenantId,
  };
}

export async function notifyGroupPrayerAddedEmail(
  emailNotification: EmailNotificationService,
  context: { memberEmails: string[]; tenantId: string | null },
  groupId: string,
  payload: PrayerFormSubmitPayload,
  prayerId: string
): Promise<void> {
  await emailNotification.notifyGroupPrayerAdded({
    groupId,
    prayerId,
    title: payload.title,
    description: payload.description,
    requester: payload.is_anonymous ? 'Anonymous' : payload.requester,
    prayerFor: payload.prayer_for,
    status: 'current',
    authorEmail: payload.email,
    memberEmails: context.memberEmails,
    tenantId: context.tenantId,
  });
}

export async function notifyGroupPrayerUpdateEmail(
  emailNotification: EmailNotificationService,
  context: { memberEmails: string[]; tenantId: string | null },
  prayer: PrayerRequest,
  content: string,
  author: string,
  authorEmail: string,
  markedAsAnswered: boolean
): Promise<void> {
  const groupId = prayer.group_id;
  if (!groupId) {
    return;
  }

  await emailNotification.notifyGroupPrayerUpdate({
    groupId,
    prayerId: prayer.id,
    prayerTitle: prayer.title,
    prayerDescription: prayer.description,
    content,
    author,
    authorEmail,
    markedAsAnswered,
    memberEmails: context.memberEmails,
    tenantId: context.tenantId,
  });
}
