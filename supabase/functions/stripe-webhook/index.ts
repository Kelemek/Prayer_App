import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

type PlanStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';

interface ChurchBillingPatch {
  plan_tier: 'free' | 'churches';
  plan_status: PlanStatus;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_cancel_at_period_end?: boolean;
  stripe_current_period_end?: string | null;
  past_due_since?: string | null;
  grace_until?: string | null;
  clear_past_due?: boolean;
  billing_past_due_notified_at?: string | null;
  clear_billing_past_due_notified?: boolean;
  should_notify_past_due?: boolean;
}

interface TenantBillingRow {
  id: string;
  plan_tier: string;
  plan_status: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_cancel_at_period_end?: boolean;
  stripe_current_period_end?: string | null;
  past_due_since?: string | null;
  grace_until?: string | null;
  billing_past_due_notified_at?: string | null;
}

function parseUnixSeconds(value: unknown): string | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

function subscriptionPeriodEndIso(subscription: Record<string, unknown>): string | null {
  const direct = parseUnixSeconds(subscription.current_period_end);
  if (direct) return direct;
  const items = subscription.items as { data?: Array<{ current_period_end?: number }> } | undefined;
  const fromItem = items?.data?.[0]?.current_period_end;
  return parseUnixSeconds(fromItem);
}

function mapStripeSubscriptionToChurchBilling(
  subscription: Record<string, unknown>,
  tenant: TenantBillingRow | null,
  graceDays: number,
  eventDeleted: boolean,
  now: Date = new Date()
): ChurchBillingPatch {
  const stripeStatus = String(subscription.status ?? 'canceled');
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  const periodEnd = subscriptionPeriodEndIso(subscription);
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : (subscription.customer as { id?: string } | undefined)?.id ?? null;
  const subscriptionId = String(subscription.id ?? '');

  const base: ChurchBillingPatch = {
    plan_tier: 'churches',
    plan_status: 'active',
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId || null,
    stripe_cancel_at_period_end: cancelAtPeriodEnd,
    stripe_current_period_end: periodEnd,
  };

  if (eventDeleted) {
    const periodEndDate = periodEnd ? new Date(periodEnd) : null;
    if (periodEndDate && periodEndDate > now) {
      return {
        ...base,
        plan_status: 'canceled',
        clear_past_due: true,
      };
    }
    return {
      plan_tier: 'free',
      plan_status: 'canceled',
      stripe_customer_id: customerId,
      stripe_subscription_id: null,
      stripe_cancel_at_period_end: false,
      stripe_current_period_end: null,
      clear_past_due: true,
      clear_billing_past_due_notified: true,
    };
  }

  if (stripeStatus === 'active' || stripeStatus === 'trialing') {
    if (cancelAtPeriodEnd) {
      return {
        ...base,
        plan_status: stripeStatus === 'trialing' ? 'trialing' : 'active',
        clear_past_due: true,
      };
    }
    return {
      ...base,
      plan_status: stripeStatus === 'trialing' ? 'trialing' : 'active',
      clear_past_due: true,
      clear_billing_past_due_notified: true,
    };
  }

  if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') {
    const since = tenant?.past_due_since ?? now.toISOString();
    const graceUntil =
      tenant?.grace_until ??
      new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000).toISOString();
    const shouldNotify = !tenant?.billing_past_due_notified_at;
    return {
      ...base,
      plan_status: 'past_due',
      past_due_since: since,
      grace_until: graceUntil,
      should_notify_past_due: shouldNotify,
      billing_past_due_notified_at: shouldNotify ? now.toISOString() : undefined,
    };
  }

  if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') {
    const periodEndDate = periodEnd ? new Date(periodEnd) : null;
    if (periodEndDate && periodEndDate > now) {
      return {
        ...base,
        plan_status: 'canceled',
        clear_past_due: true,
      };
    }
    return {
      plan_tier: 'free',
      plan_status: 'canceled',
      stripe_customer_id: customerId,
      stripe_subscription_id: null,
      stripe_cancel_at_period_end: false,
      stripe_current_period_end: null,
      clear_past_due: true,
      clear_billing_past_due_notified: true,
    };
  }

  if (stripeStatus === 'incomplete') {
    return {
      ...base,
      plan_status: 'incomplete',
    };
  }

  return {
    plan_tier: 'free',
    plan_status: 'canceled',
    stripe_customer_id: customerId,
    stripe_subscription_id: null,
    stripe_cancel_at_period_end: false,
    stripe_current_period_end: null,
    clear_past_due: true,
    clear_billing_past_due_notified: true,
  };
}

function checkoutCompletedChurchPatch(
  customerId: string | null,
  subscriptionId: string | null
): ChurchBillingPatch {
  return {
    plan_tier: 'churches',
    plan_status: 'active',
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_cancel_at_period_end: false,
    clear_past_due: true,
    clear_billing_past_due_notified: true,
  };
}

async function applyChurchBillingPatch(
  adminClient: SupabaseClient,
  tenantId: string,
  patch: ChurchBillingPatch
): Promise<void> {
  const { error } = await adminClient.rpc('apply_tenant_stripe_billing', {
    p_tenant_id: tenantId,
    p_plan_tier: patch.plan_tier,
    p_plan_status: patch.plan_status,
    p_stripe_customer_id: patch.stripe_customer_id ?? null,
    p_stripe_subscription_id: patch.stripe_subscription_id ?? null,
    p_stripe_cancel_at_period_end: patch.stripe_cancel_at_period_end ?? null,
    p_stripe_current_period_end: patch.stripe_current_period_end ?? null,
    p_past_due_since: patch.past_due_since ?? null,
    p_grace_until: patch.grace_until ?? null,
    p_clear_past_due: patch.clear_past_due ?? false,
    p_billing_past_due_notified_at: patch.billing_past_due_notified_at ?? null,
    p_clear_billing_past_due_notified: patch.clear_billing_past_due_notified ?? false,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function consumeProSignupLead(
  adminClient: SupabaseClient,
  email: string
): Promise<void> {
  await adminClient
    .from('billing_signup_leads')
    .update({
      status: 'consumed',
      consumed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('kind', 'pro')
    .eq('user_email', email)
    .in('status', ['pending', 'paid_pending_setup']);
}

async function markChurchSignupPaid(
  adminClient: SupabaseClient,
  email: string,
  userId: string | null,
  customerId: string | null,
  subscriptionId: string | null
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await adminClient
    .from('billing_signup_leads')
    .select('id')
    .eq('kind', 'church')
    .eq('user_email', email)
    .in('status', ['pending', 'paid_pending_setup'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    status: 'paid_pending_setup',
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    updated_at: now,
  };
  if (userId) {
    patch.user_id = userId;
  }

  if (existing?.id) {
    await adminClient.from('billing_signup_leads').update(patch).eq('id', existing.id);
    return;
  }

  await adminClient.from('billing_signup_leads').insert({
    kind: 'church',
    token: crypto.randomUUID(),
    user_email: email,
    user_id: userId,
    status: 'paid_pending_setup',
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
}

function churchLeadStatusFromSubscription(
  subscription: Record<string, unknown>,
  eventDeleted: boolean
): 'paid_pending_setup' | 'canceled' {
  const stripeStatus = String(subscription.status ?? 'canceled');
  if (eventDeleted) {
    return 'canceled';
  }
  if (stripeStatus === 'active' || stripeStatus === 'trialing') {
    return 'paid_pending_setup';
  }
  if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired' || stripeStatus === 'unpaid') {
    return 'canceled';
  }
  return 'paid_pending_setup';
}

async function syncChurchSignupLeadFromSubscription(
  adminClient: SupabaseClient,
  subscription: Record<string, unknown>,
  eventDeleted: boolean
): Promise<void> {
  const subscriptionId = String(subscription.id ?? '');
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : (subscription.customer as { id?: string } | undefined)?.id ?? null;
  const metadata = (subscription.metadata ?? {}) as Record<string, string>;
  if ((metadata.kind ?? '') !== 'church' && !subscriptionId) {
    return;
  }

  let query = adminClient
    .from('billing_signup_leads')
    .select('id, tenant_id, status')
    .eq('kind', 'church')
    .in('status', ['pending', 'paid_pending_setup']);

  if (subscriptionId) {
    query = query.eq('stripe_subscription_id', subscriptionId);
  } else if (customerId) {
    query = query.eq('stripe_customer_id', customerId);
  } else {
    return;
  }

  const { data: lead } = await query.maybeSingle();
  if (!lead?.id || lead.tenant_id) {
    return;
  }

  const nextStatus = churchLeadStatusFromSubscription(subscription, eventDeleted);
  await adminClient
    .from('billing_signup_leads')
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead.id);
}

async function sendPastDueNotifications(
  adminClient: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  tenantId: string,
  tenantName: string
): Promise<void> {
  const recipients = new Set<string>();

  const { data: admins } = await adminClient
    .from('tenant_memberships')
    .select('user_email')
    .eq('tenant_id', tenantId)
    .eq('role', 'tenant_admin');

  for (const row of admins ?? []) {
    if (row.user_email) recipients.add(String(row.user_email).toLowerCase());
  }

  const { data: superAdmins } = await adminClient
    .from('global_roles')
    .select('user_email')
    .eq('role', 'super_admin');

  for (const row of superAdmins ?? []) {
    if (row.user_email) recipients.add(String(row.user_email).toLowerCase());
  }

  const subject = `Church billing past due: ${tenantName}`;
  const htmlBody = `<p>The Church subscription for <strong>${tenantName}</strong> is past due.</p>
<p>Please sign in to Admin and use <strong>Manage billing</strong> to update payment before access is removed after the grace period.</p>`;
  const textBody = `The Church subscription for ${tenantName} is past due. Sign in to Admin and use Manage billing to update payment before access is removed after the grace period.`;

  for (const to of recipients) {
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject,
          htmlBody,
          textBody,
        }),
      });
    } catch (err) {
      console.error('past_due notification failed for', to, err);
    }
  }
}

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

async function loadTenantForSubscription(
  adminClient: ReturnType<typeof createClient>,
  subscription: Record<string, unknown>
): Promise<TenantBillingRow | null> {
  const metadata = (subscription.metadata ?? {}) as Record<string, string>;
  const tenantIdFromMeta = metadata.tenant_id?.trim();
  const subscriptionId = String(subscription.id ?? '');
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : (subscription.customer as { id?: string } | undefined)?.id ?? '';

  if (tenantIdFromMeta) {
    const { data } = await adminClient
      .from('tenants')
      .select(
        'id, plan_tier, plan_status, stripe_customer_id, stripe_subscription_id, stripe_cancel_at_period_end, stripe_current_period_end, past_due_since, grace_until, billing_past_due_notified_at'
      )
      .eq('id', tenantIdFromMeta)
      .maybeSingle();
    if (data) return data as TenantBillingRow;
  }

  if (subscriptionId) {
    const { data } = await adminClient
      .from('tenants')
      .select(
        'id, plan_tier, plan_status, stripe_customer_id, stripe_subscription_id, stripe_cancel_at_period_end, stripe_current_period_end, past_due_since, grace_until, billing_past_due_notified_at'
      )
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();
    if (data) return data as TenantBillingRow;
  }

  if (customerId) {
    const { data } = await adminClient
      .from('tenants')
      .select(
        'id, plan_tier, plan_status, stripe_customer_id, stripe_subscription_id, stripe_cancel_at_period_end, stripe_current_period_end, past_due_since, grace_until, billing_past_due_notified_at'
      )
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (data) return data as TenantBillingRow;
  }

  return null;
}

async function getGraceDays(adminClient: ReturnType<typeof createClient>): Promise<number> {
  const { data } = await adminClient
    .from('admin_settings')
    .select('church_past_due_grace_days')
    .eq('id', 1)
    .maybeSingle();
  const days = Number(data?.church_past_due_grace_days ?? 7);
  return Number.isFinite(days) && days >= 1 ? days : 7;
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
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  };
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { error: idempotencyError } = await adminClient.from('stripe_webhook_events').insert({
    id: event.id,
    type: event.type,
  });

  if (idempotencyError) {
    if (idempotencyError.code === '23505') {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.error('stripe_webhook_events insert failed:', idempotencyError);
    return new Response(JSON.stringify({ error: 'Idempotency check failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const kind = String(session.metadata?.kind ?? '');
    const email = String(session.metadata?.user_email ?? '').toLowerCase().trim();
    const subscriptionId = String(session.subscription ?? '');
    const customerId = String(session.customer ?? '');

    if (kind === 'pro' && email) {
      const proUpdate: Record<string, unknown> = {
        user_email: email,
        plan_tier: 'pro',
        plan_status: 'active',
        source: 'future_stripe',
        stripe_subscription_id: subscriptionId || null,
        updated_at: new Date().toISOString(),
      };
      if (customerId) {
        proUpdate.stripe_customer_id = customerId;
      }
      await adminClient.from('user_subscriptions').upsert(proUpdate, { onConflict: 'user_email' });
      await consumeProSignupLead(adminClient, email);
    }

    if (kind === 'church') {
      const tenantId = String(session.metadata?.tenant_id ?? '');
      if (tenantId) {
        const patch = checkoutCompletedChurchPatch(
          customerId || null,
          subscriptionId || null
        );
        await applyChurchBillingPatch(adminClient, tenantId, patch);
      } else if (email) {
        const userId = String(session.metadata?.user_id ?? '');
        await markChurchSignupPaid(
          adminClient,
          email,
          userId || null,
          customerId || null,
          subscriptionId || null
        );
      }
    }
  }

  if (
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const subscription = event.data.object;
    const subscriptionId = String(subscription.id ?? '');
    const metadata = (subscription.metadata ?? {}) as Record<string, string>;
    const kind = metadata.kind ?? '';

    const churchTenant = await loadTenantForSubscription(adminClient, subscription);

    if (churchTenant || kind === 'church') {
      const graceDays = await getGraceDays(adminClient);
      const patch = mapStripeSubscriptionToChurchBilling(
        subscription,
        churchTenant,
        graceDays,
        event.type === 'customer.subscription.deleted'
      );
      const tenantId = churchTenant?.id ?? metadata.tenant_id;
      if (tenantId) {
        await applyChurchBillingPatch(adminClient, tenantId, patch);
        if (patch.should_notify_past_due) {
          const { data: tenantRow } = await adminClient
            .from('tenants')
            .select('name')
            .eq('id', tenantId)
            .maybeSingle();
          await sendPastDueNotifications(
            adminClient,
            supabaseUrl,
            serviceKey,
            tenantId,
            String(tenantRow?.name ?? 'Church')
          );
        }
      } else {
        await syncChurchSignupLeadFromSubscription(
          adminClient,
          subscription,
          event.type === 'customer.subscription.deleted'
        );
      }
    } else {
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
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
