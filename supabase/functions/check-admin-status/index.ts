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
    // Create Supabase client with service role key (has full access)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const { email, tenantId } = (await req.json()) as CheckAdminRequest;

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Email is required", is_admin: false }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [superAdminResult, tenantAdminResult, legacyAdminResult] = await Promise.all([
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
        .from("email_subscribers")
        .select("is_admin")
        .eq("email", normalizedEmail)
        .eq("is_admin", true)
        .maybeSingle()
    ]);

    if (superAdminResult.error || tenantAdminResult.error || legacyAdminResult.error) {
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
    const hasLegacyAdmin = !!legacyAdminResult.data;
    const isAdmin = isSuperAdmin || isTenantAdmin || hasLegacyAdmin;

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
