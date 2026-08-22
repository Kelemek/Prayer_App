import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserSessionService } from "../services/user-session.service";

export type HomeDefaultPrayerView = "current" | "personal";

export async function updateHomeDefaultViewPreference(
  client: SupabaseClient,
  userSessionService: UserSessionService,
  preference: HomeDefaultPrayerView,
  tenantId: string | null | undefined
): Promise<boolean> {
  const email = userSessionService.getUserEmail();
  if (!email) {
    return false;
  }

  if (!tenantId) {
    return false;
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const { data: existingRecord, error: fetchError } = await client
      .from("tenant_memberships")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_email", normalizedEmail)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (existingRecord) {
      const { error: updateError } = await client
        .from("tenant_memberships")
        .update({ default_prayer_view: preference })
        .eq("tenant_id", tenantId)
        .eq("user_email", normalizedEmail);

      if (updateError) {
        throw updateError;
      }
    } else {
      const { error: insertError } = await client
        .from("tenant_memberships")
        .insert({
          user_email: normalizedEmail,
          name: email.split("@")[0] || "User",
          is_active: true,
          role: "member",
          receive_admin_emails: false,
          tenant_id: tenantId,
          default_prayer_view: preference,
        });

      if (insertError) {
        throw insertError;
      }
    }

    await userSessionService.updateUserSession({
      defaultPrayerView: preference,
    });

    return true;
  } catch (err) {
    console.error("Error updating default view preference:", err);
    return false;
  }
}
