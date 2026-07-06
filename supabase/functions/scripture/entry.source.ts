const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

const ESV_CACHE_TTL_DAYS = parseInt(Deno.env.get('ESV_CACHE_TTL_DAYS') || '30', 10);
const API_BIBLE_CACHE_TTL_DAYS = parseInt(Deno.env.get('API_BIBLE_CACHE_TTL_DAYS') || '14', 10);

function cacheTtlDaysForTranslation(translation: BibleTranslation): number {
  return translation === 'esv' ? ESV_CACHE_TTL_DAYS : API_BIBLE_CACHE_TTL_DAYS;
}

function errorStatus(message: string): number {
  if (/Scripture text not found/i.test(message)) return 404;
  if (/Invalid scripture reference format:/i.test(message)) return 400;
  if (/Invalid translation/i.test(message)) return 400;
  return 500;
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

    const translation = rawTranslation;
    const passageQueryReference = scriptureReferenceForPassageQuery(reference);
    const cacheReference = canonicalScriptureCacheReference(passageQueryReference);
    const ttlDays = cacheTtlDaysForTranslation(translation);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ttlDays);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: cached } = await supabase
      .from('scripture_cache')
      .select('text')
      .eq('reference', cacheReference)
      .eq('translation', translation)
      .gte('cached_at', cutoff.toISOString())
      .maybeSingle();

    if (cached?.text) {
      const text =
        translation === 'esv' ? cached.text : normalizeScriptureCachedText(cached.text);
      return new Response(
        JSON.stringify({
          reference,
          text,
          translation,
          cached: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await fetchScripture(passageQueryReference, translation);

    await supabase.from('scripture_cache').upsert(
      {
        reference: cacheReference,
        translation,
        text: result.text,
        cached_at: new Date().toISOString(),
      },
      { onConflict: 'reference,translation' }
    );

    return new Response(
      JSON.stringify({
        reference,
        text: result.text,
        translation: result.translation,
        cached: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: errorStatus(message),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
