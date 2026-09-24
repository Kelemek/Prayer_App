/**
 * Single pg_cron entry every 15 minutes runs this function, which invokes reminder Edge Functions
 * sequentially so PostgREST is not stamped by parallel jobs.
 * Loads tenant_settings memorization template keys once (with retry) and passes them to the memorization phase.
 * Hourly prayer/memorization phases run only on the UTC :00 tick (minute < 15); item reminders every tick.
 * Deploy with: supabase functions deploy dispatch-user-reminders --no-verify-jwt
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Max-Age': '86400',
};

const HOURLY_PHASES = [
  'send-user-hourly-prayer-reminders',
  'send-user-hourly-memorization-reminders',
] as const;

const ITEM_PHASE = 'send-user-prayer-item-reminders';

type HourlyPhaseName = (typeof HOURLY_PHASES)[number];
type PhaseName = HourlyPhaseName | typeof ITEM_PHASE;

const DISPATCHED_BY = 'dispatch-user-reminders';
const PHASE_PAUSE_MS = 2500;
const PHASE_INVOKE_ATTEMPTS = 2;
const PHASE_INVOKE_RETRY_DELAY_MS = 3500;

interface PhaseResult {
  phase: PhaseName;
  ok: boolean;
  skipped?: boolean;
  data?: unknown;
  error?: string;
}

type TenantMemorizationTemplateKeys = Record<string, string | null>;

interface DispatchRequestBody {
  forceHourly?: boolean;
}

type QueryResult<T> = {
  data: T | null;
  error: { message: string; code?: string; status?: number } | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransientPostgrestError(
  err: { message?: string; code?: string; status?: number } | null
): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  const code = String(err.code ?? '');
  const status = Number(err.status ?? 0);
  return (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    code === '500' ||
    code === '502' ||
    code === '503' ||
    code === '504' ||
    msg.includes('504') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('connection') ||
    msg.includes('gateway') ||
    msg.includes('failed to get project config') ||
    msg.includes('internal server error')
  );
}

async function withRetry<T>(
  label: string,
  fn: () => PromiseLike<QueryResult<T>>,
  opts: { attempts?: number; baseDelayMs?: number } = {}
): Promise<QueryResult<T>> {
  const attempts = opts.attempts ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  let last: QueryResult<T> = { data: null, error: { message: 'no attempt' } };
  for (let i = 0; i < attempts; i++) {
    last = await fn();
    if (!last.error) return last;
    if (!isTransientPostgrestError(last.error) || i === attempts - 1) {
      console.error(`${label} failed (attempt ${i + 1}/${attempts}):`, last.error);
      return last;
    }
    const delay = baseDelayMs * Math.pow(2, i);
    console.warn(`${label} transient error; retrying in ${delay}ms:`, last.error);
    await sleep(delay);
  }
  return last;
}

async function loadTenantMemorizationTemplateBootstrap(
  supabase: SupabaseClient
): Promise<TenantMemorizationTemplateKeys | null> {
  const { data, error } = await withRetry(
    'tenant_settings_bootstrap',
    () =>
      supabase
        .from('tenant_settings')
        .select('tenant_id, user_hourly_memorization_reminder_template_key')
  );

  if (error || !data) {
    console.warn(
      'dispatch-user-reminders: tenant_settings bootstrap unavailable; memorization phase will load settings itself.',
      error
    );
    return null;
  }

  const map: TenantMemorizationTemplateKeys = {};
  for (const row of data) {
    const r = row as {
      tenant_id: string;
      user_hourly_memorization_reminder_template_key?: string | null;
    };
    map[r.tenant_id] = r.user_hourly_memorization_reminder_template_key ?? null;
  }
  return map;
}

async function readDispatchRequestBody(req: Request): Promise<DispatchRequestBody> {
  try {
    const raw = await req.text();
    if (!raw.trim()) return {};
    return JSON.parse(raw) as DispatchRequestBody;
  } catch {
    return {};
  }
}

function invokeBodyForPhase(
  phase: PhaseName,
  bootstrap: TenantMemorizationTemplateKeys | null
): Record<string, unknown> {
  const base: Record<string, unknown> = { dispatchedBy: DISPATCHED_BY };
  if (phase === 'send-user-hourly-memorization-reminders' && bootstrap) {
    base.tenantMemorizationTemplateKeys = bootstrap;
  }
  return base;
}

async function invokePhaseWithRetry(
  supabase: SupabaseClient,
  phase: PhaseName,
  body: Record<string, unknown>
): Promise<PhaseResult> {
  let lastError = 'unknown error';

  for (let attempt = 0; attempt < PHASE_INVOKE_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      console.warn(
        `dispatch-user-reminders: retrying ${phase} (attempt ${attempt + 1}/${PHASE_INVOKE_ATTEMPTS})`
      );
      await sleep(PHASE_INVOKE_RETRY_DELAY_MS);
    }

    const { data, error } = await supabase.functions.invoke(phase, { body });

    if (!error) {
      return { phase, ok: true, data };
    }

    lastError = error.message ?? String(error);
    console.error(`dispatch-user-reminders: ${phase} invoke failed`, error);
  }

  return { phase, ok: false, error: lastError };
}

function shouldRunHourlyPhases(now: Date, forceHourly: boolean): boolean {
  if (forceHourly) return true;
  return now.getUTCMinutes() < 15;
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Cron sends Vault service_role_key. The publishable key is a valid JWT and must not
  // dispatch reminders or honor forceHourly.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token !== serviceKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const requestBody = await readDispatchRequestBody(req);
  const now = new Date();
  // forceHourly is only reachable after the service-role check above.
  const ranHourlyPhases = shouldRunHourlyPhases(now, requestBody.forceHourly === true);

  const results: PhaseResult[] = [];
  const bootstrap = await loadTenantMemorizationTemplateBootstrap(supabase);

  try {
    const phasesToRun: PhaseName[] = ranHourlyPhases
      ? [...HOURLY_PHASES, ITEM_PHASE]
      : [ITEM_PHASE];

    for (let i = 0; i < phasesToRun.length; i++) {
      const phase = phasesToRun[i];
      console.log(`dispatch-user-reminders: starting ${phase}`);
      const body = invokeBodyForPhase(phase, bootstrap);
      const result = await invokePhaseWithRetry(supabase, phase, body);
      results.push(result);

      if (result.ok) {
        console.log(`dispatch-user-reminders: ${phase} completed`, result.data);
      }

      if (i < phasesToRun.length - 1) {
        await sleep(PHASE_PAUSE_MS);
      }
    }

    if (!ranHourlyPhases) {
      for (const hourly of HOURLY_PHASES) {
        results.unshift({
          phase: hourly,
          ok: true,
          skipped: true,
        });
      }
    }

    const invoked = results.filter((r) => !r.skipped);
    const allOk = invoked.every((r) => r.ok);
    return new Response(
      JSON.stringify({
        message: allOk
          ? 'All reminder phases completed'
          : 'Reminder dispatch finished with errors',
        ranHourlyPhases,
        tenantSettingsBootstrapped: bootstrap !== null,
        phases: results,
      }),
      {
        status: allOk ? 200 : 207,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    console.error('dispatch-user-reminders:', e);
    return new Response(
      JSON.stringify({
        error: 'Unexpected error',
        details: e instanceof Error ? e.message : String(e),
        ranHourlyPhases,
        tenantSettingsBootstrapped: bootstrap !== null,
        phases: results,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
