import type { SupabaseClient } from '@supabase/supabase-js';
import { prayersByMonthOrFilter } from './prayer-community-load';
import {
  buildPendingCommunityUpdateInsertRow,
  buildSimplePendingUpdateInsertRow,
  type CommunityUpdateSubmitData,
} from './prayer-community-mutations';
import {
  buildPrayerDeletionRequestRow,
  buildUpdateDeletionRequestRow,
  type PrayerDeletionRequestInput,
  type UpdateDeletionRequestInput,
} from './prayer-community-deletion-requests';
import { maybeEq, maybeEqTenantId } from './prayer-tenant';

export async function fetchApprovedSharedPrayers(
  client: SupabaseClient,
  options: {
    tenantId: string | null;
    useSuperAdminRpc: boolean;
    actorEmail: string | null;
  }
): Promise<{ prayersData: any[]; error: unknown }> {
  const { tenantId, useSuperAdminRpc, actorEmail } = options;
  if (!tenantId) {
    return { prayersData: [], error: null };
  }

  if (useSuperAdminRpc) {
    if (!actorEmail) {
      return { prayersData: [], error: new Error('User email required to load prayers') };
    }

    const { data, error } = await client.rpc('list_approved_prayers_for_super_admin', {
      p_actor_email: actorEmail,
      p_tenant_id: tenantId,
    });
    return { prayersData: data || [], error };
  }

  const prayersTable: any = client.from('prayers');
  if (typeof prayersTable?.select !== 'function') {
    return { prayersData: [], error: null };
  }

  let prayersQuery = prayersTable
    .select('*')
    .eq('approval_status', 'approved')
    .order('created_at', { ascending: false });
  prayersQuery = maybeEqTenantId(prayersQuery, tenantId);
  const { data, error } = await prayersQuery;
  return { prayersData: data || [], error };
}

export async function fetchApprovedSharedPrayerUpdates(
  client: SupabaseClient,
  prayerIds: string[],
  options: {
    tenantId: string | null;
    useSuperAdminRpc: boolean;
    actorEmail: string | null;
  }
): Promise<{ updatesData: any[]; error: unknown }> {
  if (prayerIds.length === 0) {
    return { updatesData: [], error: null };
  }

  const { tenantId, useSuperAdminRpc, actorEmail } = options;
  if (!tenantId) {
    return { updatesData: [], error: null };
  }

  if (useSuperAdminRpc) {
    if (!actorEmail) {
      return {
        updatesData: [],
        error: new Error('User email required to load prayer updates'),
      };
    }

    const { data, error } = await client.rpc('list_approved_prayer_updates_for_super_admin', {
      p_actor_email: actorEmail,
      p_tenant_id: tenantId,
      p_prayer_ids: prayerIds,
    });
    return { updatesData: data || [], error };
  }

  let updatesQuery: any = client.from('prayer_updates').select('*');
  if (typeof updatesQuery?.in !== 'function') {
    return { updatesData: [], error: null };
  }

  updatesQuery = updatesQuery
    .in('prayer_id', prayerIds)
    .eq('approval_status', 'approved')
    .order('created_at', { ascending: false });
  updatesQuery = maybeEqTenantId(updatesQuery, tenantId);

  const { data, error } = await updatesQuery;
  return { updatesData: data || [], error };
}

export async function fetchCommunityPrayersByMonth(
  client: SupabaseClient,
  startDate: string,
  endDate: string,
  tenantId?: string | null
): Promise<{ data: Record<string, unknown>[] | null; error: unknown }> {
  let monthlyQuery = client
    .from('prayers')
    .select('*')
    .or(prayersByMonthOrFilter(startDate, endDate))
    .order('updated_at', { ascending: false });
  monthlyQuery = maybeEqTenantId(monthlyQuery, tenantId);
  const result = await monthlyQuery;
  return { data: result.data as Record<string, unknown>[] | null, error: result.error };
}

export async function fetchCommunityPrayerUpdatesByPrayerIds(
  client: SupabaseClient,
  prayerIds: string[],
  tenantId?: string | null
): Promise<{ data: any[] | null; error: unknown }> {
  let updatesQuery = client
    .from('prayer_updates')
    .select('*')
    .in('prayer_id', prayerIds)
    .eq('approval_status', 'approved')
    .order('created_at', { ascending: false });
  updatesQuery = maybeEqTenantId(updatesQuery, tenantId);
  const result = await updatesQuery;
  return { data: result.data, error: result.error };
}

export async function insertCommunityPrayerRowNoReturning(
  client: SupabaseClient,
  prayerData: Record<string, unknown>
): Promise<{ error: unknown }> {
  const result = await client.from('prayers').insert(prayerData);
  return { error: result.error };
}

export async function findTenantMembershipByEmail(
  client: SupabaseClient,
  tenantId: string,
  email: string
): Promise<{ data: { id: string } | null; error: unknown }> {
  const result = await client
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_email', email)
    .maybeSingle();
  return { data: result.data, error: result.error };
}

export async function insertTenantMembershipMemberRow(
  client: SupabaseClient,
  row: {
    name: string;
    user_email: string;
    tenant_id: string;
  }
): Promise<{ error: unknown }> {
  const result = await client.from('tenant_memberships').insert({
    name: row.name,
    user_email: row.user_email,
    is_active: true,
    role: 'member',
    tenant_id: row.tenant_id,
  });
  return { error: result.error };
}

export async function updateCommunityPrayerStatusRow(
  client: SupabaseClient,
  id: string,
  updateData: Record<string, unknown>,
  tenantId: string
): Promise<{ error: unknown }> {
  const result = await client
    .from('prayers')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId);
  return { error: result.error };
}

export async function insertPendingCommunityPrayerUpdate(
  client: SupabaseClient,
  prayerId: string,
  content: string,
  author: string,
  tenantId: string
): Promise<{ data: { id: string } | null; error: unknown }> {
  const result = await client
    .from('prayer_updates')
    .insert(buildSimplePendingUpdateInsertRow(prayerId, content, author, tenantId))
    .select()
    .single();
  return { data: result.data as { id: string } | null, error: result.error };
}

export async function insertPendingCommunityUpdate(
  client: SupabaseClient,
  updateData: CommunityUpdateSubmitData,
  tenantId: string
): Promise<{ data: { id: string } | null; error: unknown }> {
  const result = await client
    .from('prayer_updates')
    .insert(buildPendingCommunityUpdateInsertRow(updateData, tenantId))
    .select()
    .single();
  return { data: result.data as { id: string } | null, error: result.error };
}

export async function fetchCommunityPrayerTitle(
  client: SupabaseClient,
  prayerId: string,
  tenantId?: string | null
): Promise<{ data: { title?: string } | null; error: unknown }> {
  let prayerLookup: any = client.from('prayers').select('title').eq('id', prayerId);
  if (typeof prayerLookup?.single !== 'function' && typeof prayerLookup?.eq === 'function') {
    prayerLookup = prayerLookup.eq('id', prayerId);
  }
  if (tenantId) {
    prayerLookup = maybeEq(prayerLookup, 'tenant_id', tenantId);
  }
  const result = await prayerLookup.single();
  return { data: result.data, error: result.error };
}

export async function deleteCommunityPrayerRow(
  client: SupabaseClient,
  id: string,
  tenantId: string
): Promise<{ error: unknown }> {
  const result = await client
    .from('prayers')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);
  return { error: result.error };
}

export async function deleteCommunityPrayerUpdateRow(
  client: SupabaseClient,
  updateId: string,
  tenantId: string
): Promise<{ error: unknown }> {
  const result = await client
    .from('prayer_updates')
    .delete()
    .eq('id', updateId)
    .eq('tenant_id', tenantId);
  return { error: result.error };
}

export async function insertPrayerDeletionRequestRow(
  client: SupabaseClient,
  requestData: PrayerDeletionRequestInput,
  tenantId: string
): Promise<{ data: { id: string } | null; error: unknown }> {
  const result = await client
    .from('deletion_requests')
    .insert(buildPrayerDeletionRequestRow(requestData, tenantId))
    .select('id')
    .single();
  return { data: result.data as { id: string } | null, error: result.error };
}

export async function fetchPrayerRowForDeletionNotify(
  client: SupabaseClient,
  prayerId: string,
  tenantId?: string | null
): Promise<{ data: { title?: string } | null; error: unknown }> {
  let prayerLookup = client.from('prayers').select('title').eq('id', prayerId);
  prayerLookup = maybeEqTenantId(prayerLookup, tenantId);
  const result = await prayerLookup.single();
  return { data: result.data, error: result.error };
}

export async function insertUpdateDeletionRequestRow(
  client: SupabaseClient,
  requestData: UpdateDeletionRequestInput,
  tenantId: string
): Promise<{ data: { id: string } | null; error: unknown }> {
  const result = await client
    .from('update_deletion_requests')
    .insert(buildUpdateDeletionRequestRow(requestData, tenantId))
    .select('id')
    .single();
  return { data: result.data as { id: string } | null, error: result.error };
}

export async function fetchPrayerUpdateRowForDeletionNotify(
  client: SupabaseClient,
  updateId: string,
  tenantId?: string | null
): Promise<{
  data: {
    prayers?: { title?: string };
    author?: string;
    content?: string;
  } | null;
  error: unknown;
}> {
  let updateLookup = client
    .from('prayer_updates')
    .select('*, prayers!inner(title)')
    .eq('id', updateId);
  updateLookup = maybeEqTenantId(updateLookup, tenantId);
  const result = await updateLookup.single();
  return {
    data: result.data as {
      prayers?: { title?: string };
      author?: string;
      content?: string;
    } | null,
    error: result.error,
  };
}
