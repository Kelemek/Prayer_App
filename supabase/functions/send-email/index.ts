/**
 * Unified email service using the Resend API
 *
 * SUPABASE_SERVICE_ROLE_KEY is Supabase’s fixed Edge env name; its value should be the Dashboard **Secret** key
 * (sb_secret_...). Legacy service_role JWT still works; prefer Secret when creating or rotating keys.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const MAIL_SENDER_ADDRESS = Deno.env.get('MAIL_SENDER_ADDRESS')!
const MAIL_FROM_NAME = Deno.env.get('MAIL_FROM_NAME') || 'Prayer Ministry'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const RESEND_API = 'https://api.resend.com'
/** Resend max recipients per `to` / `bcc` / `cc` on a single email */
const RESEND_MAX_TO = 50
/** Resend batch endpoint: max emails per request */
const RESEND_BATCH_SIZE = 100

function buildFrom(fromName?: string): string {
  const name = fromName || MAIL_FROM_NAME
  return `${name} <${MAIL_SENDER_ADDRESS}>`
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
  replyTo?: string
  fromName?: string
  listUnsubscribeHttpsUrl?: string
}): Promise<void> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to]
  const from = buildFrom(options.fromName)

  console.log('📤 Sending email via Resend:', {
    from: MAIL_SENDER_ADDRESS,
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
        options.replyTo,
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
    replyTo?: string
    fromName?: string
  }
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0
  let failed = 0
  const errors: string[] = []
  const from = buildFrom(options.fromName)

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
          options.replyTo,
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

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase not configured')
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
      listUnsubscribeHttpsUrl,
    } = body

    if (action === 'send_to_all_subscribers') {
      console.log('📧 Action: Send to all subscribers')

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      const { data: subscribers, error } = await supabase
        .from('email_subscribers')
        .select('email, unsubscribe_token')
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

      const rows = subscribers as { email: string; unsubscribe_token: string }[]
      const result = await sendBulkToSubscribers(rows, SUPABASE_URL, {
        subject,
        htmlBody,
        textBody,
        replyTo,
        fromName,
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

    await sendEmail({
      to,
      subject,
      htmlBody,
      textBody,
      replyTo,
      fromName,
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
