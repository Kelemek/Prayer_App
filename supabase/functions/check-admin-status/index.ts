import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface CheckAdminResponse {
  success: boolean;
  is_admin: boolean;
  is_super_admin?: boolean;
  is_tenant_admin?: boolean;
  error?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS
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
        }
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized", is_admin: false }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const userEmail = userData?.user?.email?.toLowerCase().trim() ?? "";
    if (userError || !userEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized", is_admin: false }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = (await req.json()) as CheckAdminRequest;
    const requestedEmail = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    if (requestedEmail && requestedEmail !== userEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden", is_admin: false }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { tenantId } = body;
    const normalizedEmail = userEmail;

    const [superAdminResult, tenantAdminResult, anyTenantAdminResult] = await Promise.all([
      supabase
        .from('global_roles')
        .select('role')
        .eq('user_email', normalizedEmail)
        .eq('role', 'super_admin')
        .maybeSingle(),
      tenantId
        ? supabase
            .from('tenant_memberships')
            .select('role')
            .eq('tenant_id', tenantId)
            .eq('user_email', normalizedEmail)
            .eq('role', 'tenant_admin')
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('tenant_memberships')
        .select('role')
        .eq('user_email', normalizedEmail)
        .eq('role', 'tenant_admin')
        .limit(1)
        .maybeSingle()
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
        }
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
        is_tenant_admin: isTenantAdmin
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
      }
    );
  }
});
