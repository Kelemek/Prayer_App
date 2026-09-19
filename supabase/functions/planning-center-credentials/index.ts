import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

interface CredentialsBody {
  action?: string;
  tenant_id?: string;
  app_id?: string;
  secret?: string;
  enabled?: boolean;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function resolveAuthenticatedUser(
  userClient: SupabaseClient
): Promise<{ email: string } | null> {
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user?.email) {
    return null;
  }
  return { email: userData.user.email.toLowerCase().trim() };
}

async function requireTenantAdmin(
  adminClient: SupabaseClient,
  tenantId: string,
  email: string
): Promise<boolean> {
  const { data: isAdmin } = await adminClient.rpc('is_tenant_admin', {
    tenant_to_check: tenantId,
    email_to_check: email,
  });
  const { data: isSuperAdmin } = await adminClient.rpc('is_super_admin', {
    email_to_check: email,
  });
  return Boolean(isAdmin || isSuperAdmin);
}

async function requireChurchTenant(
  adminClient: SupabaseClient,
  tenantId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: tenant, error } = await adminClient
    .from('tenants')
    .select('plan_tier')
    .eq('id', tenantId)
    .maybeSingle();
  if (error || !tenant) {
    return { ok: false, status: 404, error: 'Tenant not found' };
  }
  if (tenant.plan_tier !== 'churches') {
    return { ok: false, status: 403, error: 'Planning Center is only available on Church plans' };
  }
  return { ok: true };
}

async function loadIntegrationStatus(
  adminClient: SupabaseClient,
  tenantId: string
): Promise<{ enabled: boolean; configured: boolean; app_id_last4: string | null }> {
  const { data: row } = await adminClient
    .from('tenant_integrations')
    .select('pco_enabled, pco_configured_at, pco_app_id_last4')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const { data: vaultCreds } = await adminClient.rpc('pco_vault_get', {
    p_tenant_id: tenantId,
  });

  const configured = Boolean(vaultCreds && row?.pco_configured_at);
  return {
    enabled: Boolean(row?.pco_enabled),
    configured,
    app_id_last4: row?.pco_app_id_last4 ?? null,
  };
}

async function testPlanningCenterCredentials(
  appId: string,
  secret: string
): Promise<{ ok: true } | { ok: false; status: number; error: string; details?: string }> {
  const authHeader = 'Basic ' + btoa(`${appId}:${secret}`);
  const response = await fetch(
    'https://api.planningcenteronline.com/people/v2/people?per_page=1',
    {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!response.ok) {
    const details = await response.text();
    return {
      ok: false,
      status: response.status === 401 || response.status === 403 ? 400 : response.status,
      error: 'Planning Center connection failed',
      details,
    };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  const user = await resolveAuthenticatedUser(userClient);
  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: CredentialsBody = {};
  try {
    body = (await req.json()) as CredentialsBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const tenantId = String(body.tenant_id ?? '').trim();
  if (!tenantId) {
    return jsonResponse({ error: 'tenant_id is required' }, 400);
  }

  const churchCheck = await requireChurchTenant(adminClient, tenantId);
  if (!churchCheck.ok) {
    return jsonResponse({ error: churchCheck.error }, churchCheck.status);
  }

  if (!(await requireTenantAdmin(adminClient, tenantId, user.email))) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  const action = String(body.action ?? 'status').trim().toLowerCase();

  switch (action) {
    case 'status': {
      const status = await loadIntegrationStatus(adminClient, tenantId);
      return jsonResponse({ success: true, ...status }, 200);
    }
    case 'save': {
      const appId = String(body.app_id ?? '').trim();
      const secret = String(body.secret ?? '').trim();
      if (!appId || !secret) {
        return jsonResponse({ error: 'app_id and secret are required' }, 400);
      }
      const test = await testPlanningCenterCredentials(appId, secret);
      if (!test.ok) {
        return jsonResponse(
          { error: test.error, details: test.details },
          test.status
        );
      }
      const { error: putError } = await adminClient.rpc('pco_vault_put', {
        p_tenant_id: tenantId,
        p_app_id: appId,
        p_secret: secret,
      });
      if (putError) {
        console.error('pco_vault_put failed:', putError);
        return jsonResponse({ error: 'Failed to store credentials' }, 500);
      }
      const status = await loadIntegrationStatus(adminClient, tenantId);
      return jsonResponse({ success: true, ...status }, 200);
    }
    case 'test': {
      const appId = String(body.app_id ?? '').trim();
      const secret = String(body.secret ?? '').trim();
      let testAppId = appId;
      let testSecret = secret;
      if (!testAppId || !testSecret) {
        const { data: vaultCreds } = await adminClient.rpc('pco_vault_get', {
          p_tenant_id: tenantId,
        });
        const creds = vaultCreds as { app_id?: string; secret?: string } | null;
        if (!creds?.app_id || !creds?.secret) {
          return jsonResponse({ error: 'No stored credentials; provide app_id and secret' }, 400);
        }
        testAppId = creds.app_id;
        testSecret = creds.secret;
      }
      const test = await testPlanningCenterCredentials(testAppId, testSecret);
      if (!test.ok) {
        return jsonResponse(
          { success: false, error: test.error, details: test.details },
          test.status
        );
      }
      return jsonResponse({ success: true, ok: true }, 200);
    }
    case 'enable': {
      const status = await loadIntegrationStatus(adminClient, tenantId);
      if (!status.configured) {
        return jsonResponse({ error: 'Save credentials before enabling' }, 400);
      }
      const enabled = body.enabled !== false;
      const { error: upsertError } = await adminClient.from('tenant_integrations').upsert(
        {
          tenant_id: tenantId,
          pco_enabled: enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      );
      if (upsertError) {
        console.error('tenant_integrations enable failed:', upsertError);
        return jsonResponse({ error: 'Failed to update integration' }, 500);
      }
      const next = await loadIntegrationStatus(adminClient, tenantId);
      return jsonResponse({ success: true, ...next }, 200);
    }
    case 'clear': {
      const { error: delError } = await adminClient.rpc('pco_vault_delete', {
        p_tenant_id: tenantId,
      });
      if (delError) {
        console.error('pco_vault_delete failed:', delError);
        return jsonResponse({ error: 'Failed to clear credentials' }, 500);
      }
      return jsonResponse(
        {
          success: true,
          enabled: false,
          configured: false,
          app_id_last4: null,
        },
        200
      );
    }
    default:
      return jsonResponse({ error: 'Unknown action' }, 400);
  }
});
