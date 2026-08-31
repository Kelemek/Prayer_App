import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform',
};

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const v1 = parts.find((part) => part.startsWith('v1='))?.slice(3);
  if (!timestamp || !v1) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  );
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return expected === v1;
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

  const stripeSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeSecret || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const signature = req.headers.get('stripe-signature') ?? '';
  const payload = await req.text();
  const valid = await verifyStripeSignature(payload, signature, stripeSecret);
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: Record<string, unknown> };
  };
  const adminClient = createClient(supabaseUrl, serviceKey);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const kind = String(session.metadata?.kind ?? '');
    const email = String(session.metadata?.user_email ?? '').toLowerCase().trim();
    const subscriptionId = String(session.subscription ?? '');

    if (kind === 'pro' && email) {
      await adminClient.from('user_subscriptions').upsert(
        {
          user_email: email,
          plan_tier: 'pro',
          plan_status: 'active',
          source: 'future_stripe',
          stripe_subscription_id: subscriptionId || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email' }
      );
    }

    if (kind === 'church') {
      const tenantId = String(session.metadata?.tenant_id ?? '');
      if (tenantId) {
        await adminClient
          .from('tenants')
          .update({ plan_tier: 'churches', plan_status: 'active', updated_at: new Date().toISOString() })
          .eq('id', tenantId);
        await adminClient.from('tenant_subscriptions').insert({
          tenant_id: tenantId,
          plan_tier: 'churches',
          status: 'active',
          source: 'future_stripe',
        });
      }
    }
  }

  if (
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const subscription = event.data.object;
    const subscriptionId = String(subscription.id ?? '');
    const status = String(subscription.status ?? 'canceled');
    const planStatus =
      status === 'active' || status === 'trialing'
        ? status
        : status === 'past_due'
          ? 'past_due'
          : 'canceled';

    const { data: userRow } = await adminClient
      .from('user_subscriptions')
      .select('user_email')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();

    if (userRow?.user_email) {
      await adminClient
        .from('user_subscriptions')
        .update({
          plan_tier: planStatus === 'active' || planStatus === 'trialing' ? 'pro' : 'free',
          plan_status: planStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('user_email', userRow.user_email);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
