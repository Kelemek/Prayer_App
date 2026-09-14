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

type EraseMode = 'keep_prayers' | 'wipe_prayers';

interface DeleteAccountBody {
  mode?: string;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isEraseMode(value: unknown): value is EraseMode {
  return value === 'keep_prayers' || value === 'wipe_prayers';
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

async function stripeDeleteProCustomers(
  stripeSecret: string,
  customerIds: string[]
): Promise<string> {
  if (customerIds.length === 0) {
    return 'stripe:n/a';
  }

  let anyFailed = false;
  for (const customerId of customerIds) {
    const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stripeSecret}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('Stripe customer delete failed:', customerId, body);
      anyFailed = true;
    }
  }
  return anyFailed ? 'stripe:failed' : 'stripe:deleted';
}

async function posthogDeletePerson(
  apiKey: string,
  projectId: string,
  distinctId: string
): Promise<boolean> {
  const url = `https://us.posthog.com/api/projects/${projectId}/persons?distinct_id=${encodeURIComponent(distinctId)}`;
  const listRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!listRes.ok) {
    console.error('PostHog list persons failed:', listRes.status);
    return false;
  }
  const listBody = await listRes.json().catch(() => null);
  const results = listBody?.results;
  if (!Array.isArray(results) || results.length === 0) {
    return true;
  }
  for (const person of results) {
    const uuid = person?.uuid ?? person?.id;
    if (!uuid || typeof uuid !== 'string') continue;
    const delRes = await fetch(
      `https://us.posthog.com/api/projects/${projectId}/persons/${uuid}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    if (!delRes.ok) {
      console.error('PostHog person delete failed:', delRes.status);
      return false;
    }
  }
  return true;
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
    return jsonResponse({ success: false, error: 'Too many delete attempts. Try again later.' }, 429);
  }
  recordAttempt(user.id);

  let body: DeleteAccountBody = {};
  try {
    body = (await req.json()) as DeleteAccountBody;
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  if (!isEraseMode(body.mode)) {
    return jsonResponse({ success: false, error: 'Invalid mode' }, 400);
  }

  const ops: string[] = [];

  const { data: priorErase } = await adminClient
    .from('account_erasure_events')
    .select('auth_user_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const alreadyErased = Boolean(priorErase?.auth_user_id);

  if (!alreadyErased) {
    const { data: rpcData, error: rpcError } = await adminClient.rpc('erase_user_account', {
      p_user_id: user.id,
      p_email: user.email,
      p_mode: body.mode,
    });

    if (rpcError) {
      console.error('erase_user_account failed:', rpcError);
      return jsonResponse(
        {
          success: false,
          error: 'Could not erase account data. Please try again or contact support.',
          details: rpcError.message,
        },
        500
      );
    }

    ops.push('db:erased');

    const proIdsRaw = (rpcData as { pro_stripe_customer_ids?: unknown })?.pro_stripe_customer_ids;
    const proIds: string[] = Array.isArray(proIdsRaw)
      ? proIdsRaw.filter((id): id is string => typeof id === 'string' && id.trim() !== '')
      : [];

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
    if (stripeSecret && proIds.length > 0) {
      ops.push(await stripeDeleteProCustomers(stripeSecret, proIds));
    } else if (proIds.length === 0) {
      ops.push('stripe:n/a');
    } else {
      ops.push('stripe:skipped');
    }
  } else {
    ops.push('db:already_erased');
    ops.push('stripe:n/a');
  }

  const posthogKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY')?.trim();
  const posthogProject = Deno.env.get('POSTHOG_PROJECT_ID')?.trim();
  if (posthogKey && posthogProject) {
    const okEmail = await posthogDeletePerson(posthogKey, posthogProject, user.email);
    const okUid = await posthogDeletePerson(posthogKey, posthogProject, user.id);
    ops.push(okEmail && okUid ? 'posthog:deleted' : 'posthog:failed');
  } else {
    ops.push('posthog:skipped');
  }

  ops.push('resend:n/a');
  ops.push('notion:manual');
  ops.push('github:manual');

  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (authDeleteError) {
    const msg = authDeleteError.message?.toLowerCase() ?? '';
    if (msg.includes('not found') || msg.includes('user not found')) {
      ops.push('auth:already_gone');
    } else {
      console.error('auth.admin.deleteUser failed:', authDeleteError);
      return jsonResponse(
        {
          success: false,
          error:
            'Your data was erased but we could not finish removing your login. Please try again in a moment or contact support.',
          ops,
        },
        500
      );
    }
  } else {
    ops.push('auth:deleted');
  }

  return jsonResponse(
    {
      success: true,
      mode: body.mode,
      already_erased: alreadyErased,
      ops,
    },
    200
  );
});
