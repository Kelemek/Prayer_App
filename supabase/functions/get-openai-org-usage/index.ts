// @ts-nocheck - Deno Edge Function

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const adminKey = Deno.env.get('OPENAI_ADMIN_KEY');

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
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

  let tenantId: string | null = null;
  if (req.method === 'GET') {
    const url = new URL(req.url);
    tenantId = url.searchParams.get('tenant_id');
  } else if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    tenantId = body?.tenant_id ?? null;
  } else {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
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

  const [{ data: superRow }] = await Promise.all([
    adminClient
      .from('global_roles')
      .select('role')
      .eq('user_email', email)
      .eq('role', 'super_admin')
      .maybeSingle(),
  ]);

  const isSuper = !!superRow;
  if (!isSuper) {
    return new Response(JSON.stringify({ error: 'Not authorized' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!adminKey) {
    return new Response(JSON.stringify({ configured: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const periodDays = 30;
  const end = Math.floor(Date.now() / 1000);
  const start = end - periodDays * 24 * 60 * 60;

  const costsUrl = new URL('https://api.openai.com/v1/organization/costs');
  costsUrl.searchParams.set('start_time', String(start));
  costsUrl.searchParams.set('end_time', String(end));
  costsUrl.searchParams.set('bucket_width', '1d');
  costsUrl.searchParams.set('limit', '31');

  const costsRes = await fetch(costsUrl.toString(), {
    headers: { Authorization: `Bearer ${adminKey}` },
  });

  if (!costsRes.ok) {
    const errText = await costsRes.text();
    console.error('OpenAI costs API failed:', errText);
    return new Response(
      JSON.stringify({ configured: true, error: 'Could not load OpenAI usage' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const costsPayload = await costsRes.json();
  let totalUsd = 0;
  let audioTranscriptionUsd = 0;

  for (const bucket of costsPayload?.data ?? []) {
    for (const result of bucket?.results ?? []) {
      const value = Number(result?.amount?.value ?? 0);
      totalUsd += value;
      const lineItem = String(result?.line_item ?? '').toLowerCase();
      if (lineItem.includes('audio') || lineItem.includes('transcri')) {
        audioTranscriptionUsd += value;
      }
    }
  }

  return new Response(
    JSON.stringify({
      configured: true,
      period_days: periodDays,
      total_usd: totalUsd,
      audio_transcription_usd: audioTranscriptionUsd,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
