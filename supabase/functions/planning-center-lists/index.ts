import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Max-Age': '86400',
};

interface ListsBody {
  tenant_id?: string;
  action?: string;
  listId?: string;
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

async function fetchLists(authHeader: string): Promise<Response> {
  const response = await fetch(
    'https://api.planningcenteronline.com/people/v2/lists?per_page=100',
    {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    return jsonResponse(
      { error: 'Failed to fetch Planning Center lists', details: errorText },
      response.status
    );
  }

  const data = await response.json();
  const lists = (data.data || []).map((list: { id: string; attributes?: { name?: string; description?: string } }) => ({
    id: list.id,
    name: list.attributes?.name || 'Unnamed List',
    description: list.attributes?.description || '',
  }));

  return jsonResponse({ lists, count: lists.length }, 200);
}

async function fetchListMembers(listId: string, authHeader: string): Promise<Response> {
  const members: Array<{ id: string; name: string; avatar: string | null }> = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `https://api.planningcenteronline.com/people/v2/lists/${encodeURIComponent(listId)}/people?page=${page}&per_page=100`,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse(
        { error: 'Failed to fetch Planning Center list members', details: errorText },
        response.status
      );
    }

    const data = await response.json();
    const pageMembers = (data.data || [])
      .map((person: { id: string; attributes?: { name?: string; avatar?: string } }) => ({
        id: person.id,
        name: person.attributes?.name || '',
        avatar: person.attributes?.avatar || null,
      }))
      .filter((member: { name: string }) => member.name.trim() !== '');

    members.push(...pageMembers);

    const pagination = data.meta?.pagination || {};
    hasMore =
      pagination.next_offset !== null && pagination.next_offset !== undefined;
    page++;
  }

  return jsonResponse({ members, count: members.length }, 200);
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

  let body: ListsBody = {};
  try {
    body = (await req.json()) as ListsBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const tenantId = String(body.tenant_id ?? '').trim();
  const action = String(body.action ?? '').trim();
  if (!tenantId) {
    return jsonResponse({ error: 'tenant_id is required' }, 400);
  }
  if (!action) {
    return jsonResponse({ error: 'Action is required (lists or members)' }, 400);
  }

  const pco = await loadPcoAuthHeader(adminClient, tenantId);
  if ('error' in pco) {
    return jsonResponse({ error: pco.error }, pco.status);
  }

  if (action === 'lists') {
    if (!(await requireTenantAdmin(adminClient, tenantId, user.email))) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }
    return await fetchLists(pco.authHeader);
  }

  if (action === 'members') {
    const listId = String(body.listId ?? '').trim();
    if (!listId) {
      return jsonResponse({ error: 'listId is required for members action' }, 400);
    }

    const isAdmin = await requireTenantAdmin(adminClient, tenantId, user.email);
    if (!isAdmin) {
      const { data: membership } = await adminClient
        .from('tenant_memberships')
        .select('planning_center_list_id')
        .eq('tenant_id', tenantId)
        .eq('user_email', user.email)
        .maybeSingle();

      const allowedListId = membership?.planning_center_list_id?.trim() ?? '';
      if (!allowedListId || allowedListId !== listId) {
        return jsonResponse({ error: 'Forbidden' }, 403);
      }
    }

    return await fetchListMembers(listId, pco.authHeader);
  }

  return jsonResponse({ error: 'Unknown action' }, 400);
});
