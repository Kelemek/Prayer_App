import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { classifyBearer } from './dual-auth.ts';

const EMAIL_FETCH_CONCURRENCY = 5;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Max-Age': '86400',
};

type TenantAccessAction = 'check_pco' | 'join_pco' | 'request';

interface TenantAccessBody {
  action?: TenantAccessAction;
  tenant_id?: string;
  first_name?: string;
  last_name?: string;
  affiliation_reason?: string;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function loadPcoAuthHeader(
  adminClient: SupabaseClient,
  tenantId: string,
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
  authHeader: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.planningcenteronline.com/people/v2/people/${encodeURIComponent(personId)}/emails`,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      },
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const emails = data.data || [];
    if (emails.length === 0) {
      return null;
    }
    const primary = emails.find(
      (e: { attributes?: { primary?: boolean } }) => e.attributes?.primary === true,
    );
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
  fn: (item: T) => Promise<U>,
): Promise<U[]> {
  const results: U[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

async function personMatchesEmail(
  person: { id: string; attributes?: { login_identifier?: string; first_name?: string; last_name?: string } },
  callerEmail: string,
  authHeader: string,
): Promise<{ match: boolean; firstName?: string; lastName?: string }> {
  const normalizedCaller = callerEmail.toLowerCase();
  const loginId = person.attributes?.login_identifier;
  if (loginId && String(loginId).trim().toLowerCase() === normalizedCaller) {
    return {
      match: true,
      firstName: person.attributes?.first_name,
      lastName: person.attributes?.last_name,
    };
  }
  const primaryEmail = await fetchPrimaryEmailForPerson(person.id, authHeader);
  if (primaryEmail && primaryEmail.toLowerCase() === normalizedCaller) {
    return {
      match: true,
      firstName: person.attributes?.first_name,
      lastName: person.attributes?.last_name,
    };
  }
  try {
    const response = await fetch(
      `https://api.planningcenteronline.com/people/v2/people/${encodeURIComponent(person.id)}/emails`,
      { headers: { Authorization: authHeader, 'Content-Type': 'application/json' } },
    );
    if (response.ok) {
      const data = await response.json();
      const emails = data.data || [];
      for (const row of emails) {
        const address = row?.attributes?.address;
        if (typeof address === 'string' && address.trim().toLowerCase() === normalizedCaller) {
          return {
            match: true,
            firstName: person.attributes?.first_name,
            lastName: person.attributes?.last_name,
          };
        }
      }
    }
  } catch {
    // fail closed below
  }
  return { match: false };
}

async function checkPcoExactMatch(
  adminClient: SupabaseClient,
  tenantId: string,
  callerEmail: string,
): Promise<{ pco_match: boolean; first_name?: string; last_name?: string }> {
  const pco = await loadPcoAuthHeader(adminClient, tenantId);
  if ('error' in pco) {
    return { pco_match: false };
  }

  try {
    const searchUrl =
      `https://api.planningcenteronline.com/people/v2/people?where[search_name_or_email]=${encodeURIComponent(callerEmail)}`;
    const response = await fetch(searchUrl, {
      headers: { Authorization: pco.authHeader, 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      return { pco_match: false };
    }
    const data = await response.json();
    const people = data.data || [];
    const checked = await mapWithConcurrency(people, EMAIL_FETCH_CONCURRENCY, (person) =>
      personMatchesEmail(person, callerEmail, pco.authHeader),
    );
    const hit = checked.find((c) => c.match);
    if (!hit) {
      return { pco_match: false };
    }
    return {
      pco_match: true,
      first_name: hit.firstName,
      last_name: hit.lastName,
    };
  } catch {
    return { pco_match: false };
  }
}

function resolveTenantOrigin(slug: string): string {
  const suffix = (Deno.env.get('TENANT_HOST_SUFFIX') || '').trim().toLowerCase();
  const appUrl = (Deno.env.get('APP_URL') || '').trim().replace(/\/$/, '');
  if (slug && suffix) {
    const proto = appUrl.startsWith('http://') ? 'http:' : 'https:';
    return `${proto}//${slug}.${suffix}`;
  }
  return appUrl;
}

function applyTemplateVariables(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

async function sendAdminRequestNotifications(
  adminClient: SupabaseClient,
  serviceKey: string,
  supabaseUrl: string,
  tenantId: string,
  slug: string,
  requesterEmail: string,
  firstName: string,
  lastName: string,
  affiliationReason: string,
): Promise<void> {
  const { data: adminEmails } = await adminClient.rpc('get_tenant_admin_notification_emails', {
    p_tenant_id: tenantId,
  });
  const recipients = Array.isArray(adminEmails)
    ? adminEmails.filter((e): e is string => typeof e === 'string' && e.length > 0)
    : [];
  if (recipients.length === 0) {
    return;
  }

  const { data: template } = await adminClient
    .from('email_templates')
    .select('subject, html_body, text_body')
    .eq('tenant_id', tenantId)
    .eq('template_key', 'account_approval_request')
    .maybeSingle();

  if (!template) {
    console.warn('tenant-access: account_approval_request template missing');
    return;
  }

  const tenantOrigin = resolveTenantOrigin(slug);
  const adminLink = `${tenantOrigin}/admin`;
  const requestedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  for (const adminEmail of recipients) {
    try {
      const { data: unsubRow } = await adminClient
        .from('tenant_memberships')
        .select('unsubscribe_token')
        .eq('tenant_id', tenantId)
        .eq('user_email', adminEmail)
        .maybeSingle();
      const unsubscribeUrl = unsubRow?.unsubscribe_token
        ? `${tenantOrigin}/unsubscribe?token=${unsubRow.unsubscribe_token}`
        : '';

      const vars = {
        firstName,
        lastName,
        email: requesterEmail,
        affiliationReason,
        requestedDate,
        adminLink,
        unsubscribe_url: unsubscribeUrl,
      };

      const subject = applyTemplateVariables(template.subject, vars);
      const htmlBody = applyTemplateVariables(template.html_body, vars);
      const textBody = applyTemplateVariables(template.text_body, vars);

      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: [adminEmail],
          subject,
          htmlBody,
          textBody,
          tenantId,
        }),
      });
    } catch (err) {
      console.warn('tenant-access: admin email failed', adminEmail, err);
    }
  }

  try {
    const { data: pushEmails } = await adminClient.rpc('get_tenant_admin_push_emails', {
      p_tenant_id: tenantId,
    });
    const pushList = Array.isArray(pushEmails)
      ? pushEmails.filter((e): e is string => typeof e === 'string' && e.length > 0)
      : [];
    if (pushList.length > 0) {
      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: pushList,
          title: 'Account approval request',
          body: `${firstName} ${lastName} (${requesterEmail})`,
          data: { type: 'account_approval_request' },
        }),
      });
    }
  } catch (err) {
    console.warn('tenant-access: push notify failed', err);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (classifyBearer(token, serviceKey, anonKey) !== 'user') {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  const callerEmail = userData?.user?.email?.toLowerCase().trim() ?? '';
  if (userError || !callerEmail) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: TenantAccessBody = {};
  try {
    body = (await req.json()) as TenantAccessBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const action = body.action;
  const tenantId = String(body.tenant_id ?? '').trim();
  if (!action || !tenantId) {
    return jsonResponse({ error: 'action and tenant_id are required' }, 400);
  }

  const { data: accessState, error: stateError } = await userClient.rpc('get_tenant_access_state', {
    p_tenant_id: tenantId,
  });
  if (stateError) {
    return jsonResponse({ error: stateError.message }, 400);
  }
  const stateObj = accessState as { state?: string; pco_enabled?: boolean } | null;
  const accessStateName = stateObj?.state ?? 'none';

  if (action === 'check_pco') {
    if (accessStateName !== 'none' || !stateObj?.pco_enabled) {
      return jsonResponse({ pco_match: false }, 200);
    }
    const result = await checkPcoExactMatch(adminClient, tenantId, callerEmail);
    return jsonResponse(result, 200);
  }

  if (action === 'join_pco') {
    if (accessStateName !== 'none' || !stateObj?.pco_enabled) {
      return jsonResponse({ error: 'Not eligible for PCO join' }, 400);
    }
    const pco = await checkPcoExactMatch(adminClient, tenantId, callerEmail);
    if (!pco.pco_match) {
      return jsonResponse({ error: 'Planning Center match not found' }, 403);
    }
    const firstName = String(body.first_name ?? pco.first_name ?? '').trim();
    const lastName = String(body.last_name ?? pco.last_name ?? '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName) {
      return jsonResponse({ error: 'Name is required' }, 400);
    }

    const { error: upsertError } = await adminClient.from('tenant_memberships').upsert(
      {
        tenant_id: tenantId,
        user_email: callerEmail,
        role: 'member',
        name: fullName,
        is_active: true,
        receive_admin_emails: false,
        in_planning_center: true,
        planning_center_checked_at: new Date().toISOString(),
        first_login_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,user_email' },
    );
    if (upsertError) {
      return jsonResponse({ error: upsertError.message }, 500);
    }

    await adminClient.rpc('upsert_user_subscription_free', {
      p_email: callerEmail,
      p_name: fullName,
    });

    try {
      const { data: welcomeTemplate } = await adminClient
        .from('email_templates')
        .select('subject, html_body, text_body')
        .eq('tenant_id', tenantId)
        .eq('template_key', 'subscriber_welcome')
        .maybeSingle();
      if (welcomeTemplate) {
        const vars = { firstName, lastName, email: callerEmail };
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: [callerEmail],
            subject: applyTemplateVariables(welcomeTemplate.subject, vars),
            htmlBody: applyTemplateVariables(welcomeTemplate.html_body, vars),
            textBody: applyTemplateVariables(welcomeTemplate.text_body, vars),
            tenantId,
          }),
        });
      }
    } catch (welcomeErr) {
      console.warn('tenant-access: subscriber_welcome failed', welcomeErr);
    }

    return jsonResponse({ success: true }, 200);
  }

  if (action === 'request') {
    if (accessStateName !== 'none') {
      return jsonResponse({ error: 'Not eligible to submit an access request' }, 400);
    }

    const firstName = String(body.first_name ?? '').trim();
    const lastName = String(body.last_name ?? '').trim();
    const affiliation = String(body.affiliation_reason ?? '').trim();
    if (!firstName || !lastName || !affiliation) {
      return jsonResponse({ error: 'All fields are required' }, 400);
    }

    const { data: requestResult, error: rpcError } = await userClient.rpc('create_tenant_access_request', {
      p_tenant_id: tenantId,
      p_first_name: firstName,
      p_last_name: lastName,
      p_affiliation_reason: affiliation,
    });
    if (rpcError) {
      return jsonResponse({ error: rpcError.message }, 400);
    }

    const created =
      typeof requestResult === 'object' &&
      requestResult !== null &&
      (requestResult as { created?: boolean }).created === true;
    const requestId =
      typeof requestResult === 'object' && requestResult !== null
        ? (requestResult as { id?: string }).id
        : requestResult;

    const { data: tenantRow } = await adminClient
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .maybeSingle();
    const slug = tenantRow?.slug ?? '';

    if (created) {
      try {
        await sendAdminRequestNotifications(
          adminClient,
          serviceKey,
          supabaseUrl,
          tenantId,
          slug,
          callerEmail,
          firstName,
          lastName,
          affiliation,
        );
      } catch (notifyErr) {
        console.warn('tenant-access: notifications failed (non-fatal)', notifyErr);
      }
    }

    return jsonResponse({ success: true, request_id: requestId }, 200);
  }

  return jsonResponse({ error: 'Unknown action' }, 400);
});
