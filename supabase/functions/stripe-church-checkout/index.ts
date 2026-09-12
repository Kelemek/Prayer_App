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

async function createStripeCustomer(
  stripeSecret: string,
  email: string,
  metadata: Record<string, string>
): Promise<{ id?: string; error?: unknown }> {
  const params = new URLSearchParams({ email });
  for (const [key, value] of Object.entries(metadata)) {
    params.set(`metadata[${key}]`, value);
  }
  const customerRes = await fetch('https://api.stripe.com/v1/customers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const customer = await customerRes.json();
  if (!customerRes.ok) {
    return { error: customer };
  }
  return { id: customer.id };
}

async function createCheckoutSession(
  stripeSecret: string,
  args: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
    subscriptionMetadata: Record<string, string>;
  }
): Promise<{ url?: string; error?: unknown }> {
  const params = new URLSearchParams({
    mode: 'subscription',
    customer: args.customerId,
    'line_items[0][price]': args.priceId,
    'line_items[0][quantity]': '1',
    'managed_payments[enabled]': 'false',
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  });
  for (const [key, value] of Object.entries(args.metadata)) {
    params.set(`metadata[${key}]`, value);
  }
  for (const [key, value] of Object.entries(args.subscriptionMetadata)) {
    params.set(`subscription_data[metadata][${key}]`, value);
  }
  const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const session = await sessionRes.json();
  if (!sessionRes.ok) {
    return { error: session };
  }
  return { url: session.url };
}

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
  const userId = userData.user.id;

  if (tenantId) {
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
      const created = await createStripeCustomer(stripeSecret, email, {
        kind: 'church',
        tenant_id: tenantId,
      });
      if (!created.id) {
        console.error('Stripe customer create failed:', created.error);
        return new Response(JSON.stringify({ error: 'Failed to create Stripe customer' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      customerId = created.id;
      await adminClient
        .from('tenants')
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);
    }

    const session = await createCheckoutSession(stripeSecret, {
      customerId,
      priceId,
      successUrl: `${returnOrigin}/admin?church_checkout=success`,
      cancelUrl: `${returnOrigin}/admin?church_checkout=cancel`,
      metadata: {
        kind: 'church',
        tenant_id: tenantId,
        user_email: email,
        user_id: userId,
      },
      subscriptionMetadata: {
        kind: 'church',
        tenant_id: tenantId,
      },
    });
    if (!session.url) {
      console.error('Stripe checkout session failed:', session.error);
      return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: setupState } = await userClient.rpc('get_church_setup_state');
  const status = (setupState as { status?: string } | null)?.status;
  if (status === 'attached') {
    return new Response(JSON.stringify({ error: 'You already have a Church subscription' }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (status === 'paid_pending_setup') {
    return new Response(
      JSON.stringify({ error: 'Finish church setup', code: 'setup_pending' }),
      {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  await userClient.rpc('create_billing_signup_lead', { p_kind: 'church' });

  const { data: existingLead } = await adminClient
    .from('billing_signup_leads')
    .select('id, stripe_customer_id, token')
    .eq('kind', 'church')
    .eq('user_email', email)
    .in('status', ['pending', 'paid_pending_setup'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let customerId = existingLead?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const created = await createStripeCustomer(stripeSecret, email, {
      kind: 'church',
      user_id: userId,
    });
    if (!created.id) {
      console.error('Stripe customer create failed:', created.error);
      return new Response(JSON.stringify({ error: 'Failed to create Stripe customer' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    customerId = created.id;
    if (existingLead?.id) {
      await adminClient
        .from('billing_signup_leads')
        .update({
          stripe_customer_id: customerId,
          user_id: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingLead.id);
    }
  }

  const session = await createCheckoutSession(stripeSecret, {
    customerId,
    priceId,
    successUrl: `${returnOrigin}/church-setup?church_checkout=success`,
    cancelUrl: `${returnOrigin}/church-setup?church_checkout=cancel`,
    metadata: {
      kind: 'church',
      user_email: email,
      user_id: userId,
    },
    subscriptionMetadata: {
      kind: 'church',
      user_id: userId,
    },
  });
  if (!session.url) {
    console.error('Stripe checkout session failed:', session.error);
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
