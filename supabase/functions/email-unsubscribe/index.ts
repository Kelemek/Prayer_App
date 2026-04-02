/**
 * Public unsubscribe: sets email_subscribers.is_active = false by opaque token.
 * GET: browser link; POST: RFC 8058 one-click (form) or JSON { token } from SPA.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Max-Age': '86400',
}

function normalizeAppUrl(raw: string | undefined, fallback: string): string {
  let u = (raw ?? fallback).trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(u)) {
    if (/^localhost\b/i.test(u) || /^127\.0\.0\.1\b/.test(u)) {
      u = `http://${u}`
    } else {
      u = `https://${u}`
    }
  }
  return u
}

async function parseToken(req: Request, url: URL): Promise<string | null> {
  const fromQuery = url.searchParams.get('token')?.trim() || ''

  if (req.method === 'GET') {
    return fromQuery || null
  }

  if (req.method !== 'POST') {
    return fromQuery || null
  }

  const ct = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()

  if (ct === 'application/x-www-form-urlencoded') {
    const text = await req.text()
    const params = new URLSearchParams(text)
    if (params.get('List-Unsubscribe') === 'One-Click') {
      return fromQuery || params.get('token')?.trim() || null
    }
    const t = params.get('token')?.trim()
    return t || fromQuery || null
  }

  // application/json or missing / non-standard Content-Type (some clients omit it)
  try {
    const text = await req.text()
    if (text) {
      const body = JSON.parse(text) as { token?: string }
      const t = typeof body?.token === 'string' ? body.token.trim() : ''
      if (t) return t
    }
  } catch {
    /* ignore */
  }

  return fromQuery || null
}

async function deactivateByToken(
  supabase: ReturnType<typeof createClient>,
  token: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('email_subscribers')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .select('id')

  if (error) {
    console.error('unsubscribe update error:', error)
    return false
  }
  return Array.isArray(data) && data.length > 0
}

function htmlPage(title: string, message: string, appUrl: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:48px auto;padding:0 16px;color:#1f2937;"><h1 style="font-size:1.25rem;">${title}</h1><p>${message}</p><p style="margin-top:24px;"><a href="${appUrl}/" style="color:#2563eb;">Return to app</a></p></body></html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  // Same env name as all Edge functions; value = Dashboard Secret key (or legacy service_role JWT).
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const appUrl = normalizeAppUrl(Deno.env.get('APP_URL'), 'http://localhost:4200')

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  let token: string | null = null

  try {
    if (req.method === 'GET' || req.method === 'POST') {
      token = await parseToken(req, url)
    }
  } catch (e) {
    console.error('parseToken:', e)
  }

  if (!token) {
    if (req.method === 'GET') {
      return new Response(
        htmlPage(
          'Unsubscribe',
          'This unsubscribe link is invalid or incomplete.',
          appUrl
        ),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const ok = await deactivateByToken(supabase, token)

  if (!ok) {
    if (req.method === 'GET') {
      return new Response(
        htmlPage(
          'Unsubscribe',
          'We could not process this link. It may have expired or already been used.',
          appUrl
        ),
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }
    return new Response(JSON.stringify({ ok: true, message: 'Already unsubscribed or unknown token' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Unsubscribe success for token prefix:', token.slice(0, 8))

  if (req.method === 'GET') {
    return new Response(
      htmlPage(
        'Unsubscribed',
        'You have been unsubscribed from these emails. You can turn email back on anytime in the app settings.',
        appUrl
      ),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
