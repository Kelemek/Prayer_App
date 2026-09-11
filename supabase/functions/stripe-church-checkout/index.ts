import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Allowed: APP_URL host, www.{host}, or single-label subdomain of that host. */
function resolveStripeReturnOrigin(
  appUrl: string,
  returnOrigin: string | undefined | null
): string {
  const base = (appUrl || 'http://localhost:4200').replace(/\/+$/, '');
  const candidate = returnOrigin?.trim();
  if (!candidate) {
    return base;
  }
  let baseHost: string;
  let candidateHost: string;
  try {
    baseHost = new URL(base.startsWith('http') ? base : `https://${base}`).hostname.toLowerCase();
    candidateHost = new URL(
      candidate.startsWith('http') ? candidate : `https://${candidate}`
    ).hostname.toLowerCase();
  } catch {
    return base;
  }
  if (candidateHost === baseHost || candidateHost === `www.${baseHost}`) {
    return candidate.replace(/\/+$/, '');
  }
  const suffix = `.${baseHost}`;
  if (candidateHost.endsWith(suffix)) {
    const prefix = candidateHost.slice(0, -suffix.length);
    if (prefix && !prefix.includes('.')) {
      return candidate.replace(/\/+$/, '');
    }
  }
  return base;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const priceId = Deno.env.get('STRIPE_CHURCH_PRICE_ID');
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:4200';

  if (!stripeSecret || !supabaseUrl || !serviceKey || !priceId) {
    return new Response(JSON.stringify({ error: 'Stripe Church checkout is not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({}));
  const returnOrigin = resolveStripeReturnOrigin(
    appUrl,
    typeof body.return_origin === 'string' ? body.return_origin : null
  );
  const tenantId = String(body.tenant_id ?? '').trim();
  if (!tenantId) {
    return new Response(JSON.stringify({ error: 'tenant_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const email = userData.user.email.toLowerCase().trim();

  const { data: tenant, error: tenantError } = await adminClient
    .from('tenants')
    .select('id, stripe_customer_id')
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantError || !tenant) {
    return new Response(JSON.stringify({ error: 'Tenant not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: isAdmin } = await adminClient.rpc('is_tenant_admin', {
    tenant_to_check: tenantId,
    email_to_check: email,
  });
  const { data: isSuperAdmin } = await adminClient.rpc('is_super_admin', {
    email_to_check: email,
  });

  if (!isAdmin && !isSuperAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let customerId = tenant.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customerRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email,
        'metadata[kind]': 'church',
        'metadata[tenant_id]': tenantId,
      }),
    });
    const customer = await customerRes.json();
    if (!customerRes.ok) {
      console.error('Stripe customer create failed:', customer);
      return new Response(JSON.stringify({ error: 'Failed to create Stripe customer' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    customerId = customer.id;

    await adminClient
      .from('tenants')
      .update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);
  }

  const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      mode: 'subscription',
      customer: customerId!,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      // Managed Payments (default on new Stripe accounts) requires product tax codes.
      'managed_payments[enabled]': 'false',
      success_url: `${returnOrigin}/admin?church_checkout=success`,
      cancel_url: `${returnOrigin}/admin?church_checkout=cancel`,
      'metadata[kind]': 'church',
      'metadata[tenant_id]': tenantId,
      'metadata[user_email]': email,
      'subscription_data[metadata][kind]': 'church',
      'subscription_data[metadata][tenant_id]': tenantId,
    }),
  });

  const session = await sessionRes.json();
  if (!sessionRes.ok) {
    console.error('Stripe checkout session failed:', session);
    return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
