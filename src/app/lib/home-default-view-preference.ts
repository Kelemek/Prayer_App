import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserSessionService } from "../services/user-session.service";

export type HomeDefaultPrayerView = "current" | "personal" | "groups";

export const HOME_DEFAULT_PRAYER_VIEW_OPTIONS: ReadonlyArray<{
  value: HomeDefaultPrayerView;
  label: string;
  title: string;
  description: string;
}> = [
  {
    value: "current",
    label: "Church Prayers",
    title: "Open church prayers by default",
    description: "You will see church prayers when you log in",
  },
  {
    value: "groups",
    label: "Group Prayers",
    title: "Open group prayers by default",
    description: "You will see group prayers when you log in",
  },
  {
    value: "personal",
    label: "Personal Prayers",
    title: "Open personal prayers by default",
    description: "You will see personal prayers when you log in",
  },
];

export function parseHomeDefaultPrayerView(
  value: string | undefined | null
): HomeDefaultPrayerView {
  switch (value) {
    case "personal":
      return "personal";
    case "groups":
      return "groups";
    case "current":
      return "current";
    default:
      return "current";
  }
}

export function homeDefaultPrayerViewLabel(
  view: HomeDefaultPrayerView
): string {
  switch (view) {
    case "current":
      return "Church Prayers";
    case "groups":
      return "Group Prayers";
    case "personal":
      return "Personal Prayers";
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

export function homeDefaultPrayerViewDescription(
  view: HomeDefaultPrayerView
): string {
  switch (view) {
    case "current":
      return "You will see church prayers when you log in";
    case "groups":
      return "You will see group prayers when you log in";
    case "personal":
      return "You will see personal prayers when you log in";
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

export function resolveHomeFilterForDefaultView(
  preferred: HomeDefaultPrayerView,
  access: { canAccessShared: boolean; canAccessGroupsTab: boolean }
): HomeDefaultPrayerView {
  if (!access.canAccessShared && access.canAccessGroupsTab) {
    return "groups";
  }
  if (preferred === "groups") {
    return access.canAccessGroupsTab ? "groups" : "current";
  }
  return preferred;
}

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
