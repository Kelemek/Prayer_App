/**
 * Unified email service using the Resend API.
 * Per-tenant From / Reply-To: keep helpers aligned with src/lib/mail-identity.ts
 *
 * SUPABASE_SERVICE_ROLE_KEY is Supabase’s fixed Edge env name; its value should be the Dashboard **Secret** key
 * (sb_secret_...). Legacy service_role JWT still works; prefer Secret when creating or rotating keys.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { classifyBearer, decideUserAdmin } from './dual-auth.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const MAIL_SENDER_ADDRESS = Deno.env.get('MAIL_SENDER_ADDRESS')!
const MAIL_FROM_NAME = Deno.env.get('MAIL_FROM_NAME') || 'Prayer Ministry'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

const RESEND_API = 'https://api.resend.com'
/** Resend max recipients per `to` / `bcc` / `cc` on a single email */
const RESEND_MAX_TO = 50
/** Resend batch endpoint: max emails per request */
const RESEND_BATCH_SIZE = 100

const MAIL_FROM_LOCAL_PART_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
const MAIL_REPLY_TO_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

interface MailIdentity {
  fromName: string
  fromAddress: string
  fromHeader: string
  replyTo?: string
}

function platformDomainFromSenderAddress(senderAddress: string): string | null {
  const trimmed = senderAddress.trim()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0 || at === trimmed.length - 1) return null
  const domain = trimmed.slice(at + 1).trim().toLowerCase()
  return domain || null
}

function coerceMailFromLocalPart(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v || !MAIL_FROM_LOCAL_PART_PATTERN.test(v)) return null
  return v
}

function coerceMailFromName(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v || v.length > 78 || /[<>\r\n]/.test(v)) return null
  return v
}

function coerceMailReplyTo(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v || v.length > 254 || /[\r\n<>]/.test(v) || !MAIL_REPLY_TO_PATTERN.test(v)) {
    return null
  }
  return v.toLowerCase()
}

function platformMailIdentity(fromNameOverride?: string, replyToOverride?: string): MailIdentity {
  const fromName = coerceMailFromName(fromNameOverride) || MAIL_FROM_NAME
  const replyTo = coerceMailReplyTo(replyToOverride)
  return {
    fromName,
    fromAddress: MAIL_SENDER_ADDRESS,
    fromHeader: `${fromName} <${MAIL_SENDER_ADDRESS}>`,
    replyTo: replyTo || undefined,
  }
}

function tenantMailIdentity(
  row: {
    mail_from_name?: string | null
    mail_from_local_part?: string | null
    mail_reply_to?: string | null
  } | null
): MailIdentity {
  const domain = platformDomainFromSenderAddress(MAIL_SENDER_ADDRESS)
  const fromName = coerceMailFromName(row?.mail_from_name) || MAIL_FROM_NAME
  const localPart = coerceMailFromLocalPart(row?.mail_from_local_part)
  const fromAddress =
    domain && localPart ? `${localPart}@${domain}` : MAIL_SENDER_ADDRESS
  const replyTo = coerceMailReplyTo(row?.mail_reply_to)
  return {
    fromName,
    fromAddress,
    fromHeader: `${fromName} <${fromAddress}>`,
    replyTo: replyTo || undefined,
  }
}

async function resolveMailIdentity(
  supabase: ReturnType<typeof createClient>,
  tenantId?: string | null,
  fromNameOverride?: string,
  replyToOverride?: string
): Promise<MailIdentity> {
  const tid = typeof tenantId === 'string' ? tenantId.trim() : ''
  if (!tid) {
    return platformMailIdentity(fromNameOverride, replyToOverride)
  }

  const { data, error } = await supabase
    .from('tenant_settings')
    .select('mail_from_name, mail_from_local_part, mail_reply_to')
    .eq('tenant_id', tid)
    .maybeSingle()

  if (error) {
    console.error('tenant mail identity lookup failed; using platform fallback:', error)
    return platformMailIdentity()
  }

  return tenantMailIdentity(data)
}

function listUnsubscribeHeaders(listUnsubscribeHttpsUrl?: string): Record<string, string> {
  const mailto = `<mailto:${MAIL_SENDER_ADDRESS}?subject=unsubscribe>`
  const u = listUnsubscribeHttpsUrl?.trim()
  if (u) {
    return {
      'List-Unsubscribe': `<${u}>, ${mailto}`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }
  }
  return { 'List-Unsubscribe': mailto }
}

function basePayload(
  from: string,
  subject: string,
  htmlBody?: string,
  textBody?: string,
  replyTo?: string,
  listUnsubscribeHttpsUrl?: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    from,
    subject,
    headers: listUnsubscribeHeaders(listUnsubscribeHttpsUrl),
  }
  if (htmlBody) payload.html = htmlBody
  if (textBody !== undefined) payload.text = textBody
  if (replyTo) payload.reply_to = replyTo
  return payload
}

function oneClickUnsubscribeUrl(supabaseUrl: string, token: string): string {
  const base = supabaseUrl.replace(/\/+$/, '')
  return `${base}/functions/v1/email-unsubscribe?token=${encodeURIComponent(token)}`
}

/** Match Edge APP_URL / Angular appUrl for readable unsubscribe links in bulk mail. */
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

function prettyUnsubscribeUrl(supabaseUrl: string, token: string): string {
  const appRaw = Deno.env.get('APP_URL')?.trim()
  if (appRaw) {
    const base = normalizeAppUrl(appRaw, '').replace(/\/+$/, '')
    return `${base}/unsubscribe?token=${encodeURIComponent(token)}`
  }
  return oneClickUnsubscribeUrl(supabaseUrl, token)
}

function injectUnsubscribeUrl(
  htmlBody: string | undefined,
  textBody: string | undefined,
  token: string,
  supabaseUrl: string
): { htmlBody?: string; textBody?: string } {
  const pretty = prettyUnsubscribeUrl(supabaseUrl, token)
  return {
    htmlBody:
      htmlBody !== undefined
        ? htmlBody.split('{{unsubscribe_url}}').join(pretty)
        : undefined,
    textBody:
      textBody !== undefined
        ? textBody.split('{{unsubscribe_url}}').join(pretty)
        : undefined,
  }
}

async function postResend(path: string, body: unknown): Promise<Response> {
  return fetch(`${RESEND_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

/**
 * Send one logical email; chunks `to` if more than RESEND_MAX_TO addresses.
 */
async function sendEmail(options: {
  to: string | string[]
  subject: string
  htmlBody?: string
  textBody?: string
  identity: MailIdentity
  listUnsubscribeHttpsUrl?: string
}): Promise<void> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to]
  const from = options.identity.fromHeader

  console.log('📤 Sending email via Resend:', {
    from: options.identity.fromAddress,
    to:
      recipients.length > 5
        ? `${recipients.slice(0, 5).join(', ')}... (${recipients.length} total)`
        : recipients,
    subject: options.subject,
    hasHtmlBody: !!options.htmlBody,
    hasTextBody: !!options.textBody,
  })

  for (let i = 0; i < recipients.length; i += RESEND_MAX_TO) {
    const chunk = recipients.slice(i, i + RESEND_MAX_TO)
    const payload = {
      ...basePayload(
        from,
        options.subject,
        options.htmlBody,
        options.textBody,
        options.identity.replyTo,
        options.listUnsubscribeHttpsUrl
      ),
      to: chunk,
    }

    const response = await postResend('/emails', payload)

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Resend API error:', {
        status: response.status,
        statusText: response.statusText,
        error,
      })
      throw new Error(`Resend send failed: ${response.status} ${error}`)
    }
  }

  console.log(`✅ Email sent to ${recipients.length} recipient(s)`)
}

/**
 * Send to many subscribers: one recipient per message via /emails/batch (privacy + Resend limits).
 */
async function sendBulkToSubscribers(
  recipients: { email: string; unsubscribe_token: string }[],
  supabaseUrl: string,
  options: {
    subject: string
    htmlBody?: string
    textBody?: string
    identity: MailIdentity
  }
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0
  let failed = 0
  const errors: string[] = []
  const from = options.identity.fromHeader

  console.log(`📧 Sending to ${recipients.length} subscribers via Resend batch...`)

  for (let i = 0; i < recipients.length; i += RESEND_BATCH_SIZE) {
    const slice = recipients.slice(i, i + RESEND_BATCH_SIZE)
    const batchPayload = slice.map((row) => {
      const injected = injectUnsubscribeUrl(
        options.htmlBody,
        options.textBody,
        row.unsubscribe_token,
        supabaseUrl
      )
      return {
        ...basePayload(
          from,
          options.subject,
          injected.htmlBody ?? options.htmlBody,
          injected.textBody ?? options.textBody,
          options.identity.replyTo,
          oneClickUnsubscribeUrl(supabaseUrl, row.unsubscribe_token)
        ),
        to: [row.email],
      }
    })

    const response = await postResend('/emails/batch', batchPayload)

    if (!response.ok) {
      const error = await response.text()
      failed += slice.length
      errors.push(`Batch offset ${i}: ${error}`)
      console.error(`❌ Resend batch failed:`, error)
    } else {
      sent += slice.length
      console.log(`✅ Batch sent (${slice.length} emails)`)
    }

    if (i + RESEND_BATCH_SIZE < recipients.length) {
      await new Promise((r) => setTimeout(r, 250))
    }
  }

  console.log(`✅ Bulk send complete: ${sent} sent, ${failed} failed`)
  return { sent, failed, errors }
}

const authJsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

function bearerToken(req: Request): string {
  const authHeader = req.headers.get('Authorization') ?? ''
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
}

async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.clone().json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null
    return body as Record<string, unknown>
  } catch {
    return null
  }
}

function tenantIdFrom(body: Record<string, unknown> | null): string {
  if (!body) return ''
  if (typeof body.tenantId === 'string') return body.tenantId.trim()
  if (typeof body.tenant_id === 'string') return body.tenant_id.trim()
  return ''
}

function isSelfAddressed(body: Record<string, unknown> | null, email: string): boolean {
  if (!body) return false
  const raw = body.to
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  const recipients = list
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter((value) => value.length > 0)
  return recipients.length > 0 && recipients.every((value) => value === email)
}

async function callerIsAdmin(
  admin: SupabaseClient,
  email: string,
  tenantId: string,
): Promise<boolean> {
  if (tenantId) {
    const { data, error } = await admin.rpc('is_tenant_admin', {
      tenant_to_check: tenantId,
      email_to_check: email,
    })
    return !error && Boolean(data)
  }
  const { data: isSuper, error: superError } = await admin.rpc('is_super_admin', {
    email_to_check: email,
  })
  if (superError) return false
  if (isSuper) return true
  const { data: row, error } = await admin
    .from('tenant_memberships')
    .select('user_email')
    .eq('user_email', email)
    .eq('role', 'tenant_admin')
    .limit(1)
    .maybeSingle()
  return !error && Boolean(row)
}

function authError(status: 401 | 403): Response {
  return new Response(
    JSON.stringify({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }),
    { status, headers: authJsonHeaders },
  )
}

async function rejectUnlessServiceOrAdmin(req: Request): Promise<Response | null> {
  const token = bearerToken(req)
  const kind = classifyBearer(token, SUPABASE_SERVICE_ROLE_KEY ?? '', SUPABASE_ANON_KEY ?? '')
  if (kind === 'service_role') return null
  if (kind === 'anonymous' || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return authError(401)
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await userClient.auth.getUser()
  const email = data?.user?.email?.toLowerCase().trim() ?? ''
  if (error || !email) return authError(401)
  const body = await readJsonObject(req)
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const isAdmin = await callerIsAdmin(admin, email, tenantIdFrom(body))
  const decision = decideUserAdmin(email, isAdmin, isSelfAddressed(body, email))
  if (!decision.ok) return authError(decision.status)
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  try {
    console.log('📧 Email service: Received request')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase not configured')
    }

    // Service-key equality runs before getUser because the secret is not a user JWT.
    const rejected = await rejectUnlessServiceOrAdmin(req)
    if (rejected) return rejected

    if (!RESEND_API_KEY) {
      throw new Error(
        'Resend not configured. Set RESEND_API_KEY for the send-email function.'
      )
    }

    if (!MAIL_SENDER_ADDRESS) {
      throw new Error(
        'MAIL_SENDER_ADDRESS not configured. Use a verified domain address in Resend.'
      )
    }

    const body = await req.json()
    const {
      action,
      to,
      subject,
      htmlBody,
      textBody,
      replyTo,
      fromName,
      tenantId,
      tenant_id,
      listUnsubscribeHttpsUrl,
    } = body
    const resolvedTenantId =
      typeof tenantId === 'string'
        ? tenantId.trim()
        : typeof tenant_id === 'string'
          ? tenant_id.trim()
          : ''

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if (action === 'send_to_all_subscribers') {
      console.log('📧 Action: Send to all subscribers')

      if (!resolvedTenantId) {
        throw new Error('tenantId is required for send_to_all_subscribers')
      }

      const identity = await resolveMailIdentity(supabase, resolvedTenantId)

      const { data: subscribers, error } = await supabase
        .from('tenant_memberships')
        .select('user_email, unsubscribe_token')
        .eq('tenant_id', resolvedTenantId)
        .eq('is_active', true)
        .eq('is_blocked', false)

      if (error) throw error

      if (!subscribers || subscribers.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No active subscribers found',
            sent: 0,
            failed: 0,
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        )
      }

      const rows = subscribers as { user_email: string; unsubscribe_token: string }[]
      const result = await sendBulkToSubscribers(
        rows.map((r) => ({ email: r.user_email, unsubscribe_token: r.unsubscribe_token })),
        SUPABASE_URL, {
        subject,
        htmlBody,
        textBody,
        identity,
      })

      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    console.log('📧 Action: Send email')

    if (!to) {
      throw new Error('Missing required field: to')
    }

    if (!subject) {
      throw new Error('Missing required field: subject')
    }

    const identity = await resolveMailIdentity(
      supabase,
      resolvedTenantId || null,
      typeof fromName === 'string' ? fromName : undefined,
      typeof replyTo === 'string' ? replyTo : undefined
    )

    await sendEmail({
      to,
      subject,
      htmlBody,
      textBody,
      identity,
      listUnsubscribeHttpsUrl:
        typeof listUnsubscribeHttpsUrl === 'string'
          ? listUnsubscribeHttpsUrl
          : undefined,
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('❌ Error:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: String(error),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
