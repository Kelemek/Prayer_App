import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EMAIL_FETCH_CONCURRENCY = 5;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Max-Age': '86400',
};

interface LookupBody {
  tenant_id?: string;
  email?: string;
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

async function loadPcoAuthHeader(
  adminClient: SupabaseClient,
  tenantId: string
): Promise<{ authHeader: string } | { error: string; status: number }> {
  const { data: tenant } = await adminClient
    .from('tenants')
    .select('plan_tier')
    .eq('id', tenantId)
    .maybeSingle();
  if (!tenant || tenant.plan_tier !== 'churches') {
    return { error: 'Planning Center is only available on Church plans', status: 403 };
  }

  const { data: integration } = await adminClient
    .from('tenant_integrations')
    .select('pco_enabled')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!integration?.pco_enabled) {
    return { error: 'Planning Center is not enabled for this church', status: 403 };
  }

  const { data: vaultCreds } = await adminClient.rpc('pco_vault_get', {
    p_tenant_id: tenantId,
  });
  const creds = vaultCreds as { app_id?: string; secret?: string } | null;
  if (!creds?.app_id || !creds?.secret) {
    return { error: 'Planning Center not configured', status: 503 };
  }

  return { authHeader: 'Basic ' + btoa(`${creds.app_id}:${creds.secret}`) };
}

async function fetchPrimaryEmailForPerson(
  personId: string,
  authHeader: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.planningcenteronline.com/people/v2/people/${encodeURIComponent(personId)}/emails`,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const emails = data.data || [];
    if (emails.length === 0) {
      return null;
    }
    const primary = emails.find((e: { attributes?: { primary?: boolean } }) => e.attributes?.primary === true);
    const first = emails[0];
    const address = primary?.attributes?.address ?? first?.attributes?.address ?? null;
    return typeof address === 'string' && address.trim() ? address.trim() : null;
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<U>
): Promise<U[]> {
  const results: U[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
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

  let body: LookupBody = {};
  try {
    body = (await req.json()) as LookupBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const tenantId = String(body.tenant_id ?? '').trim();
  const searchTerm = String(body.email ?? '').trim();
  if (!tenantId) {
    return jsonResponse({ error: 'tenant_id is required' }, 400);
  }
  if (!searchTerm) {
    return jsonResponse({ error: 'Email address is required' }, 400);
  }

  if (!(await requireTenantAdmin(adminClient, tenantId, user.email))) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  const pco = await loadPcoAuthHeader(adminClient, tenantId);
  if ('error' in pco) {
    return jsonResponse({ error: pco.error }, pco.status);
  }

  try {
    const searchUrl = `https://api.planningcenteronline.com/people/v2/people?where[search_name_or_email]=${encodeURIComponent(searchTerm)}`;
    const response = await fetch(searchUrl, {
      headers: {
        Authorization: pco.authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Planning Center API error:', response.status, errorText);
      return jsonResponse(
        { error: 'Failed to search Planning Center', details: errorText },
        response.status
      );
    }

    const data = await response.json();
    const people = data.data || [];

    const peopleData = await mapWithConcurrency(people, EMAIL_FETCH_CONCURRENCY, async (person: {
      id: string;
      attributes?: { login_identifier?: string };
    }) => {
      const loginId = person.attributes?.login_identifier;
      const emailFromLogin =
        loginId && String(loginId).trim() ? String(loginId).trim() : null;
      const primaryEmail =
        emailFromLogin ?? (await fetchPrimaryEmailForPerson(person.id, pco.authHeader));
      return {
        ...person,
        attributes: {
          ...person.attributes,
          primary_email_address: primaryEmail || null,
        },
      };
    });

    return jsonResponse({ people: peopleData, count: peopleData.length }, 200);
  } catch (error) {
    console.error('Error in planning-center-lookup:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
