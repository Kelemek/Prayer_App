import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { classifyBearer } from "./dual-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Max-Age": "86400",
};

interface CheckAdminRequest {
  email: string;
  tenantId?: string;
}

async function resolveAdminEmail(
  req: Request,
  body: CheckAdminRequest,
  supabaseUrl: string,
  serviceKey: string,
  anonKey: string,
): Promise<
  | { ok: true; email: string; tenantId?: string }
  | { ok: false; status: 400 | 401 | 403 | 500; error: string }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const kind = classifyBearer(token, serviceKey, anonKey);
  const requestedEmail =
    typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const tenantId =
    typeof body.tenantId === "string" ? body.tenantId.trim() : undefined;

  if (kind === "service_role") {
    if (!requestedEmail) {
      return { ok: false, status: 400, error: "Email is required" };
    }
    return { ok: true, email: requestedEmail, tenantId };
  }

  if (kind === "anonymous") {
    if (!requestedEmail || !tenantId) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: settings, error: settingsError } = await adminClient
      .from("tenant_settings")
      .select("require_site_login")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (settingsError) {
      return { ok: false, status: 500, error: "Database error" };
    }
    if (settings?.require_site_login !== false) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
    return { ok: true, email: requestedEmail, tenantId };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const userEmail = userData?.user?.email?.toLowerCase().trim() ?? "";
  if (userError || !userEmail) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  if (requestedEmail && requestedEmail !== userEmail) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, email: userEmail, tenantId };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error", is_admin: false }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json()) as CheckAdminRequest;
    const resolved = await resolveAdminEmail(req, body, supabaseUrl, serviceKey, anonKey);
    if (!resolved.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: resolved.error,
          is_admin: false,
        }),
        {
          status: resolved.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const normalizedEmail = resolved.email;
    const { tenantId } = resolved;

    const [superAdminResult, tenantAdminResult, anyTenantAdminResult] = await Promise.all([
      supabase
        .from("global_roles")
        .select("role")
        .eq("user_email", normalizedEmail)
        .eq("role", "super_admin")
        .maybeSingle(),
      tenantId
        ? supabase
            .from("tenant_memberships")
            .select("role")
            .eq("tenant_id", tenantId)
            .eq("user_email", normalizedEmail)
            .eq("role", "tenant_admin")
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("tenant_memberships")
        .select("role")
        .eq("user_email", normalizedEmail)
        .eq("role", "tenant_admin")
        .limit(1)
        .maybeSingle(),
    ]);

    if (superAdminResult.error || tenantAdminResult.error || anyTenantAdminResult.error) {
      return new Response(
        JSON.stringify({
          success: false,
          is_admin: false,
          error: "Database error",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const isSuperAdmin = !!superAdminResult.data;
    const isTenantAdmin = !!tenantAdminResult.data;
    const hasAnyTenantAdmin = !!anyTenantAdminResult.data;
    const isAdmin = isSuperAdmin || isTenantAdmin || hasAnyTenantAdmin;

    return new Response(
      JSON.stringify({
        success: true,
        is_admin: isAdmin,
        is_super_admin: isSuperAdmin,
        is_tenant_admin: isTenantAdmin,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in check-admin-status:", error);
    return new Response(
      JSON.stringify({
        success: false,
        is_admin: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
