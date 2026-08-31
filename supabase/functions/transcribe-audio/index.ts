// @ts-nocheck - Deno Edge Function

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

const WHISPER_MODEL_RATES_USD_PER_MINUTE: Record<string, number> = {
  'whisper-1': 0.006,
  'gpt-4o-mini-transcribe': 0.003,
};
const DEFAULT_WHISPER_MODEL = 'whisper-1';
const MAX_BYTES = 10 * 1024 * 1024;
const RECITE_MAX_AUDIO_SECONDS = 180;
/** Conservative opus speech estimate for billing when client under-reports duration. */
const BYTES_PER_SECOND_ESTIMATE = 8000;

function estimateAudioSecondsFromBytes(byteSize: number): number {
  if (byteSize <= 0) return 0;
  return Math.min(
    RECITE_MAX_AUDIO_SECONDS,
    Math.max(1, byteSize / BYTES_PER_SECOND_ESTIMATE)
  );
}

function resolveBilledAudioSeconds(clientSeconds: number, byteSize: number): number {
  const client = Number.isFinite(clientSeconds) ? Math.max(0, clientSeconds) : 0;
  const fromFile = estimateAudioSecondsFromBytes(byteSize);
  return Math.min(RECITE_MAX_AUDIO_SECONDS, Math.max(client, fromFile));
}

function resolveWhisperModel(value: string | null | undefined): string {
  const model = String(value ?? '').trim();
  if (model in WHISPER_MODEL_RATES_USD_PER_MINUTE) return model;
  return DEFAULT_WHISPER_MODEL;
}

function whisperRateUsdPerMinute(model: string): number {
  return WHISPER_MODEL_RATES_USD_PER_MINUTE[model] ?? WHISPER_MODEL_RATES_USD_PER_MINUTE[DEFAULT_WHISPER_MODEL]!;
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!openaiKey) {
    return new Response(
      JSON.stringify({ error: 'OpenAI transcription is not configured on the server.' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
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

  const userEmail = userData.user.email.toLowerCase().trim();

  const { data: reciteAllowed, error: reciteAllowedError } = await adminClient.rpc(
    'user_practice_mode_allowed',
    { p_mode: 'recite', p_email: userEmail }
  );
  if (reciteAllowedError) {
    console.error('user_practice_mode_allowed failed:', reciteAllowedError);
    return new Response(JSON.stringify({ error: 'Could not verify plan access' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!reciteAllowed) {
    return new Response(JSON.stringify({ error: 'Recite mode is not available on your plan' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const form = await req.formData();
    const audio = form.get('audio');
    const tenantId = String(form.get('tenant_id') ?? '').trim();
    const prompt = String(form.get('prompt') ?? '').trim();
    const memorizedItemId = String(form.get('memorized_item_id') ?? '').trim() || null;
    const audioSecondsRaw = Number(form.get('audio_seconds'));
    const clientAudioSeconds = Number.isFinite(audioSecondsRaw) ? Math.max(0, audioSecondsRaw) : 0;

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenant_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!(audio instanceof File)) {
      return new Response(JSON.stringify({ error: 'audio file is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (audio.size > MAX_BYTES) {
      return new Response(JSON.stringify({ error: 'Audio file too large' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings, error: settingsError } = await adminClient
      .from('tenant_settings')
      .select('memorization_recite_enabled, memorization_recite_stt_provider, memorization_recite_whisper_model')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (settingsError) {
      console.error('tenant_settings read failed:', settingsError);
      return new Response(JSON.stringify({ error: 'Could not verify tenant settings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: tenantRow } = await adminClient
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .maybeSingle();
    const isDefaultTenant = tenantRow?.slug === 'default-tenant';

    if (!isDefaultTenant) {
      if (!settings?.memorization_recite_enabled || settings.memorization_recite_stt_provider !== 'whisper') {
        return new Response(JSON.stringify({ error: 'Recite Whisper is not enabled for this organization' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: membership, error: membershipError } = await adminClient
      .from('tenant_memberships')
      .select('user_email')
      .eq('tenant_id', tenantId)
      .eq('user_email', userEmail)
      .maybeSingle();

    if (membershipError) {
      console.error('tenant_memberships read failed:', membershipError);
      return new Response(JSON.stringify({ error: 'Could not verify organization membership' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!membership && !isDefaultTenant) {
      return new Response(JSON.stringify({ error: 'Not a member of this organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const whisperModel = resolveWhisperModel(
      isDefaultTenant ? DEFAULT_WHISPER_MODEL : settings?.memorization_recite_whisper_model
    );
    const whisperRate = whisperRateUsdPerMinute(whisperModel);

    const openaiForm = new FormData();
    openaiForm.append('file', audio, audio.name || 'recording.webm');
    openaiForm.append('model', whisperModel);
    openaiForm.append('language', 'en');
    if (prompt) {
      openaiForm.append('prompt', prompt.slice(0, 800));
    }

    const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: openaiForm,
    });

    const openaiPayload = await openaiRes.json();
    if (!openaiRes.ok) {
      console.error('OpenAI transcription failed:', openaiPayload);
      return new Response(
        JSON.stringify({ error: 'Transcription failed', details: openaiPayload?.error?.message }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcript = String(openaiPayload?.text ?? '').trim();
    const billedAudioSeconds = resolveBilledAudioSeconds(clientAudioSeconds, audio.size);
    const estimatedCost = (billedAudioSeconds / 60) * whisperRate;

    const { error: insertError } = await adminClient.from('memorization_recite_usage').insert({
      tenant_id: tenantId,
      user_email: userEmail,
      memorized_item_id: memorizedItemId,
      stt_provider: 'whisper',
      audio_seconds: billedAudioSeconds,
      model: whisperModel,
      rate_usd_per_minute: whisperRate,
      estimated_cost_usd: estimatedCost,
      billable: true,
    });

    if (insertError) {
      console.error('usage insert failed:', insertError);
    }

    return new Response(JSON.stringify({ transcript }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('transcribe-audio error:', err);
    return new Response(JSON.stringify({ error: 'Failed to transcribe audio' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
