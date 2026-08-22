import type { SupabaseClient } from "@supabase/supabase-js";
import { PERSONAL_PRAYERS_LIST_SELECT } from "./prayer-personal-display";
import { markPersonalPrayerUpdateAnsweredPatch } from "./prayer-personal-mutations";
import { personalCategoryRenameDbPayload } from "./prayer-personal-rename";
import { buildClearPersonalPrayerAnsweredFlagsPayload } from "./prayer-personal-update";
import { maybeEqTenantId } from "./prayer-tenant";

export async function fetchPersonalPrayersList(
  client: SupabaseClient,
  userEmail: string,
  tenantId?: string | null
): Promise<{ data: unknown[] | null; error: unknown }> {
  let query = client
    .from("personal_prayers")
    .select(PERSONAL_PRAYERS_LIST_SELECT)
    .eq("user_email", userEmail);
  query = maybeEqTenantId(query, tenantId);
  const result = await query
    .order("display_order", { ascending: false })
    .order("created_at", { ascending: false });
  return { data: result.data, error: result.error };
}

export async function insertPersonalPrayerRow(
  client: SupabaseClient,
  prayerData: Record<string, unknown>
): Promise<{ data: unknown; error: unknown }> {
  const result = await client
    .from("personal_prayers")
    .insert(prayerData)
    .select()
    .single();
  return { data: result.data, error: result.error };
}

export async function deletePersonalPrayerRow(
  client: SupabaseClient,
  id: string,
  userEmail: string,
  tenantId?: string | null
): Promise<{ error: unknown }> {
  let query = client
    .from("personal_prayers")
    .delete()
    .eq("id", id)
    .eq("user_email", userEmail);
  query = maybeEqTenantId(query, tenantId);
  const result = await query;
  return { error: result.error };
}

export async function updatePersonalPrayerRow(
  client: SupabaseClient,
  id: string,
  userEmail: string,
  updateData: Record<string, unknown>,
  tenantId?: string | null
): Promise<{ error: unknown }> {
  let query = client
    .from("personal_prayers")
    .update(updateData)
    .eq("id", id)
    .eq("user_email", userEmail);
  query = maybeEqTenantId(query, tenantId);
  const result = await query;
  return { error: result.error };
}

export async function clearPersonalPrayerUpdateAnsweredFlags(
  client: SupabaseClient,
  personalPrayerId: string
): Promise<{ error: unknown }> {
  const result = await client
    .from("personal_prayer_updates")
    .update(buildClearPersonalPrayerAnsweredFlagsPayload())
    .eq("personal_prayer_id", personalPrayerId);
  return { error: result.error };
}

export async function fetchPersonalPrayerCategoryIdRows(
  client: SupabaseClient,
  userEmail: string,
  tenantId?: string | null
): Promise<{ data: Array<{ id: string; category: string | null }> | null; error: unknown }> {
  let query = client
    .from("personal_prayers")
    .select("id, category")
    .eq("user_email", userEmail);
  query = maybeEqTenantId(query, tenantId);
  const result = await query;
  return { data: result.data, error: result.error };
}

export async function renamePersonalPrayerCategoriesByIds(
  client: SupabaseClient,
  userEmail: string,
  prayerIds: string[],
  newCategoryName: string,
  tenantId?: string | null
): Promise<{ error: unknown }> {
  let query = client
    .from("personal_prayers")
    .update(personalCategoryRenameDbPayload(newCategoryName))
    .eq("user_email", userEmail)
    .in("id", prayerIds);
  query = maybeEqTenantId(query, tenantId);
  const result = await query;
  return { error: result.error };
}

export async function insertPersonalPrayerUpdateRow(
  client: SupabaseClient,
  updateData: Record<string, unknown>
): Promise<{ data: unknown[] | null; error: unknown }> {
  const inserted: any = client.from("personal_prayer_updates").insert(updateData);
  if (inserted && typeof inserted.select === "function") {
    const selected = inserted.select();
    if (selected && typeof selected.then === "function") {
      const result = await selected;
      return { data: result.data, error: result.error };
    }
    if (selected && typeof selected.single === "function") {
      const result = await selected.single();
      const row = result.data;
      return {
        data: row ? (Array.isArray(row) ? row : [row]) : [],
        error: result.error,
      };
    }
    return { data: selected?.data ?? [], error: selected?.error ?? null };
  }
  const result = await inserted;
  return { data: result?.data ?? [], error: result?.error };
}

export async function updatePersonalPrayerUpdateRow(
  client: SupabaseClient,
  updateId: string,
  updateData: Record<string, unknown>
): Promise<{ error: unknown }> {
  const result = await client
    .from("personal_prayer_updates")
    .update(updateData)
    .eq("id", updateId);
  return { error: result.error };
}

export async function deletePersonalPrayerUpdateRow(
  client: SupabaseClient,
  updateId: string,
  authorEmail: string
): Promise<{ error: unknown }> {
  const result = await client
    .from("personal_prayer_updates")
    .delete()
    .eq("id", updateId)
    .eq("author_email", authorEmail);
  return { error: result.error };
}

export async function markPersonalPrayerUpdateAnsweredRow(
  client: SupabaseClient,
  updateId: string
): Promise<{ error: unknown }> {
  const result = await client
    .from("personal_prayer_updates")
    .update(markPersonalPrayerUpdateAnsweredPatch())
    .eq("id", updateId);
  return { error: result.error };
}

export async function rpcIncrementPersonalPrayedFor(
  client: SupabaseClient,
  prayerId: string,
  userEmail: string
): Promise<{ data: unknown; error: unknown }> {
  const result = await client.rpc("increment_personal_prayed_for_count", {
    personal_prayer_id: prayerId,
    p_user_email: userEmail,
  });
  return { data: result.data, error: result.error };
}

export async function rpcReorderPersonalPrayers(
  client: SupabaseClient,
  args: Record<string, unknown>
): Promise<{ data: unknown; error: unknown }> {
  const result = await client.rpc("reorder_personal_prayers", args);
  return { data: result.data, error: result.error };
}

export async function rpcPersonalCategoryMutation(
  client: SupabaseClient,
  rpcName: "reorder_personal_prayer_categories" | "swap_personal_prayer_categories",
  args: Record<string, unknown>
): Promise<{ data: unknown; error: unknown }> {
  const result = await client.rpc(rpcName, args);
  return { data: result.data, error: result.error };
}

export async function fetchPersonalPrayerForShare(
  client: SupabaseClient,
  personalPrayerId: string,
  tenantId: string
): Promise<{ data: any; error: unknown }> {
  const result = await client
    .from("personal_prayers")
    .select(`
          id,
          title,
          description,
          prayer_for,
          user_email,
          category,
          created_at,
          personal_prayer_updates (
            id,
            content,
            author,
            author_email,
            mark_as_answered,
            created_at
          )
        `)
    .eq("id", personalPrayerId)
    .eq("tenant_id", tenantId)
    .single();
  return { data: result.data, error: result.error };
}

export async function insertSharedCommunityPrayerRow(
  client: SupabaseClient,
  prayerData: Record<string, unknown>
): Promise<{ data: { id: string } | null; error: unknown }> {
  const result = await client.from("prayers").insert(prayerData).select().single();
  return { data: result.data as { id: string } | null, error: result.error };
}

export async function insertSharedCommunityPrayerUpdates(
  client: SupabaseClient,
  updatesCopy: Record<string, unknown>[]
): Promise<{ error: unknown }> {
  const result = await client.from("prayer_updates").insert(updatesCopy);
  return { error: result.error };
}
