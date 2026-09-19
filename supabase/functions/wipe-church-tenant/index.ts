import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_ATTEMPTS = 8;
const recentAttempts = new Map<string, number[]>();

interface WipeChurchBody {
  tenant_id?: string;
  confirm_slug?: string;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const times = (recentAttempts.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recentAttempts.set(userId, times);
  return times.length >= RATE_MAX_ATTEMPTS;
}

function recordAttempt(userId: string): void {
  const times = recentAttempts.get(userId) ?? [];
  times.push(Date.now());
  recentAttempts.set(userId, times);
}

async function resolveAuthenticatedUser(
  userClient: SupabaseClient
): Promise<{ id: string; email: string } | null> {
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user?.id || !userData.user.email) {
    return null;
  }
  return {
    id: userData.user.id,
    email: userData.user.email.toLowerCase().trim(),
  };
}

async function stripeCancelSubscription(
  stripeSecret: string,
  subscriptionId: string
): Promise<'stripe:canceled' | 'stripe:already_canceled' | 'stripe:cancel_failed'> {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${stripeSecret}` },
  });
  if (res.ok) {
    return 'stripe:canceled';
  }
  const body = await res.json().catch(() => ({}));
  const err = body as { error?: { code?: string; message?: string } };
  const code = err.error?.code ?? '';
  const message = (err.error?.message ?? '').toLowerCase();
  if (code === 'resource_missing' || message.includes('no such subscription')) {
    return 'stripe:already_canceled';
  }
  console.error('Stripe subscription cancel failed:', subscriptionId, body);
  return 'stripe:cancel_failed';
}

async function stripeDeleteCustomer(
  stripeSecret: string,
  customerId: string
): Promise<'stripe:deleted' | 'stripe:already_gone' | 'stripe:failed'> {
  const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${stripeSecret}` },
  });
  if (res.ok) {
    return 'stripe:deleted';
  }
  const body = await res.json().catch(() => ({}));
  const err = body as { error?: { code?: string; message?: string } };
  const code = err.error?.code ?? '';
  const message = (err.error?.message ?? '').toLowerCase();
  if (code === 'resource_missing' || message.includes('no such customer')) {
    return 'stripe:already_gone';
  }
  console.error('Stripe customer delete failed:', customerId, body);
  return 'stripe:failed';
}

async function countDowngradedMembers(
  adminClient: SupabaseClient,
  memberEmails: string[]
): Promise<number> {
  let downgraded = 0;
  for (const email of memberEmails) {
    const { data: isPro } = await adminClient.rpc('user_has_pro', { p_email: email });
    if (isPro === true) {
      continue;
    }
    const { data: isChurch } = await adminClient.rpc('user_is_church_member', {
      p_email: email,
    });
    if (isChurch !== true) {
      downgraded += 1;
    }
  }
  return downgraded;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ success: false, error: 'Server configuration error' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  const user = await resolveAuthenticatedUser(userClient);
  if (!user) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  if (isRateLimited(user.id)) {
    return jsonResponse(
      { success: false, error: 'Too many wipe attempts. Try again later.' },
      429
    );
  }
  recordAttempt(user.id);

  let body: WipeChurchBody = {};
  try {
    body = (await req.json()) as WipeChurchBody;
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const tenantId = body.tenant_id?.trim();
  const confirmSlug = body.confirm_slug?.trim();
  if (!tenantId || !confirmSlug) {
    return jsonResponse({ success: false, error: 'tenant_id and confirm_slug required' }, 400);
  }

  const { data: isAdmin } = await adminClient.rpc('is_tenant_admin', {
    tenant_to_check: tenantId,
    email_to_check: user.email,
  });
  const { data: isSuperAdmin } = await adminClient.rpc('is_super_admin', {
    email_to_check: user.email,
  });

  if (!isAdmin && !isSuperAdmin) {
    return jsonResponse({ success: false, error: 'Forbidden' }, 403);
  }

  const { data: tenantRow } = await adminClient
    .from('tenants')
    .select('id, slug, stripe_customer_id, stripe_subscription_id')
    .eq('id', tenantId)
    .maybeSingle();

  const ops: string[] = [];

  if (!tenantRow) {
    const { data: prior } = await adminClient
      .from('tenant_wipe_events')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (prior?.tenant_id) {
      ops.push('db:already_wiped');
      ops.push('stripe:n/a');
      ops.push('members:downgraded:0');
      return jsonResponse({ success: true, already_wiped: true, ops }, 200);
    }

    return jsonResponse({ success: false, error: 'Tenant not found' }, 404);
  }

  if (tenantRow.slug === 'default-tenant') {
    return jsonResponse({ success: false, error: 'Cannot wipe default tenant' }, 400);
  }

  if (confirmSlug.toLowerCase() !== String(tenantRow.slug).toLowerCase()) {
    return jsonResponse({ success: false, error: 'Slug confirmation mismatch' }, 400);
  }

  const stripeCustomerId = tenantRow.stripe_customer_id as string | null;
  const stripeSubscriptionId = tenantRow.stripe_subscription_id as string | null;
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')?.trim();

  if (stripeSecret) {
    if (stripeSubscriptionId) {
      const cancelOp = await stripeCancelSubscription(stripeSecret, stripeSubscriptionId);
      ops.push(cancelOp);
    } else {
      ops.push('stripe:already_canceled');
    }

    if (stripeCustomerId) {
      ops.push(await stripeDeleteCustomer(stripeSecret, stripeCustomerId));
    } else {
      ops.push('stripe:n/a');
    }
  } else {
    ops.push('stripe:skipped');
  }

  const { data: rpcData, error: rpcError } = await adminClient.rpc('wipe_church_tenant', {
    p_tenant_id: tenantId,
    p_confirm_slug: confirmSlug,
    p_wiped_by_email: user.email,
  });

  if (rpcError) {
    console.error('wipe_church_tenant failed:', rpcError);
    const msg = rpcError.message?.toLowerCase() ?? '';
    if (msg.includes('slug confirmation')) {
      return jsonResponse({ success: false, error: 'Slug confirmation mismatch', ops }, 400);
    }
    if (msg.includes('default tenant')) {
      return jsonResponse({ success: false, error: 'Cannot wipe default tenant', ops }, 400);
    }
    if (msg.includes('tenant not found')) {
      return jsonResponse({ success: false, error: 'Tenant not found', ops }, 404);
    }
    return jsonResponse(
      {
        success: false,
        error: 'Could not wipe church data. Please try again or contact support.',
        details: rpcError.message,
        ops,
      },
      500
    );
  }

  const alreadyWiped = Boolean((rpcData as { already_wiped?: boolean })?.already_wiped);
  ops.push(alreadyWiped ? 'db:already_wiped' : 'db:wiped');

  const memberEmailsRaw = (rpcData as { member_emails?: unknown })?.member_emails;
  const memberEmails: string[] = Array.isArray(memberEmailsRaw)
    ? memberEmailsRaw.filter((e): e is string => typeof e === 'string' && e.trim() !== '')
    : [];

  const downgraded = await countDowngradedMembers(adminClient, memberEmails);
  ops.push(`members:downgraded:${downgraded}`);

  return jsonResponse(
    {
      success: true,
      already_wiped: alreadyWiped,
      tenant_id: tenantId,
      ops,
    },
    200
  );
});
