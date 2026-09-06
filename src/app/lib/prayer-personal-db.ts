import type { SupabaseClient } from "@supabase/supabase-js";
import { PERSONAL_PRAYERS_LIST_SELECT } from "./prayer-personal-display";
import { markPersonalPrayerUpdateAnsweredPatch } from "./prayer-personal-mutations";
import { buildClearPersonalPrayerAnsweredFlagsPayload } from "./prayer-personal-update";
import { eqTenantIdOrUnaffiliated } from "./prayer-tenant";
import type { PersonalCategory } from "../types/personal-category";

export async function fetchPersonalPrayersList(
  client: SupabaseClient,
  userEmail: string,
  tenantId?: string | null
): Promise<{ data: unknown[] | null; error: unknown }> {
  let query = client
    .from("personal_prayers")
    .select(PERSONAL_PRAYERS_LIST_SELECT)
    .eq("user_email", userEmail);
  query = eqTenantIdOrUnaffiliated(query, tenantId);
  const result = await query
    .order("display_order", { ascending: false })
    .order("created_at", { ascending: false });
  return { data: result.data, error: result.error };
}

export async function fetchPersonalCategoriesList(
  client: SupabaseClient,
  userEmail: string,
  tenantId: string
): Promise<{ data: PersonalCategory[] | null; error: unknown }> {
  const result = await client
    .from("personal_categories")
    .select("id, name, display_order, color")
    .eq("tenant_id", tenantId)
    .ilike("user_email", userEmail.trim())
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  return {
    data: (result.data as PersonalCategory[] | null) ?? null,
    error: result.error,
  };
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
  query = eqTenantIdOrUnaffiliated(query, tenantId);
  const result = await query;
  return { error: result.error };
}

export async function updatePersonalPrayerRow(
  client: SupabaseClient,
  id: string,
  userEmail: string,
  updateData: Record<string, unknown>
  ,
  tenantId?: string | null
): Promise<{ error: unknown }> {
  let query = client
    .from("personal_prayers")
    .update(updateData)
    .eq("id", id)
    .eq("user_email", userEmail);
  query = eqTenantIdOrUnaffiliated(query, tenantId);
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

export async function rpcEnsurePersonalCategory(
  client: SupabaseClient,
  name: string,
  tenantId: string
): Promise<{ data: string | null; error: unknown }> {
  const result = await client.rpc("ensure_personal_category", {
    p_name: name,
    p_tenant_id: tenantId,
  });
  return { data: (result.data as string | null) ?? null, error: result.error };
}

export async function rpcReorderPersonalCategories(
  client: SupabaseClient,
  orderedIds: string[]
): Promise<{ error: unknown }> {
  const result = await client.rpc("reorder_personal_categories", {
    p_ordered_ids: orderedIds,
  });
  return { error: result.error };
}

export async function rpcReorderPersonalPrayers(
  client: SupabaseClient,
  args: Record<string, unknown>
): Promise<{ data: unknown; error: unknown }> {
  const result = await client.rpc("reorder_personal_prayers", args);
  return { data: result.data, error: result.error };
}

export async function rpcRenamePersonalCategory(
  client: SupabaseClient,
  id: string,
  name: string
): Promise<{ error: unknown }> {
  const result = await client.rpc("rename_personal_category", {
    p_id: id,
    p_name: name,
  });
  return { error: result.error };
}

export async function rpcDeletePersonalCategory(
  client: SupabaseClient,
  id: string
): Promise<{ error: unknown }> {
  const result = await client.rpc("delete_personal_category", { p_id: id });
  return { error: result.error };
}

export async function queryMaxDisplayOrderForCategoryId(
  client: SupabaseClient,
  userEmail: string,
  categoryId: string | null,
  tenantId?: string | null
): Promise<{
  data: { display_order?: number | null } | null;
  error: unknown;
}> {
  let query = client
    .from("personal_prayers")
    .select("display_order")
    .eq("user_email", userEmail);
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }
  if (categoryId === null) {
    query = query.is("category_id", null);
  } else {
    query = query.eq("category_id", categoryId);
  }
  const result = await query
    .order("display_order", { ascending: false })
    .limit(1);
  if (result.error) {
    return { data: null, error: result.error };
  }
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return { data: row ?? null, error: null };
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
          category_id,
          personal_categories (
            name
          ),
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
  const row = result.data as
    | {
        personal_categories?: { name: string } | { name: string }[] | null;
      }
    | null;
  const joined = row?.personal_categories;
  const categoryName = Array.isArray(joined) ? joined[0]?.name : joined?.name;
  return {
    data: row ? { ...row, category: categoryName ?? null } : row,
    error: result.error,
  };
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
