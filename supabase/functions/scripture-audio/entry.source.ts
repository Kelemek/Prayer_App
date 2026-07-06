const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

async function resolveEsvPassageAudioUrl(reference: string): Promise<string | null> {
  const apiToken = Deno.env.get('ESV_API_TOKEN');
  if (!apiToken) return null;
  const q = scriptureReferenceForPassageQuery(reference.trim());
  if (!q) return null;

  let url = `https://api.esv.org/v3/passage/audio/?q=${encodeURIComponent(q)}`;
  for (let hop = 0; hop < 8; hop += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Token ${apiToken}` },
      redirect: 'manual',
    });
    if (response.status >= 300 && response.status < 400) {
      const loc = response.headers.get('location');
      if (!loc) return null;
      url = new URL(loc, url).toString();
      continue;
    }
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('audio') || /\.mp3(\?|$)/i.test(url)) {
      return url;
    }
    return null;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get('reference')?.trim();
    const rawTranslation = (url.searchParams.get('translation') || 'esv').toLowerCase();

    if (!reference) {
      return new Response(JSON.stringify({ error: 'Scripture reference is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isBibleTranslation(rawTranslation)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid translation. Must be one of: esv, kjv, nasb, lsb, niv, nlt, csb',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (rawTranslation === 'esv') {
      const audioUrl = await resolveEsvPassageAudioUrl(reference);
      if (!audioUrl) {
        if (!Deno.env.get('ESV_API_TOKEN')) {
          return new Response(JSON.stringify({ error: 'ESV audio is not configured.' }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({ error: 'Could not resolve ESV audio for this passage.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ audioUrl, useSpeechSynthesis: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isApiBibleTranslation(rawTranslation)) {
      return new Response(JSON.stringify({ audioUrl: null, useSpeechSynthesis: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const translation = rawTranslation as ApiBibleTranslation;
    const audioUrl = await resolveApiBiblePassageAudioUrl(reference, translation);
    if (!audioUrl) {
      return new Response(JSON.stringify({ audioUrl: null, useSpeechSynthesis: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ audioUrl, useSpeechSynthesis: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to load audio.' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
