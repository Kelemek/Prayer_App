import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Marked } from 'https://esm.sh/marked@15.0.12';

// ----- TipTap markdown → safe HTML (inline; keep aligned with src/lib/edge-email-markdown.ts) -----
/** TipTap hard breaks: `\` + newline or two spaces + newline → plain newline. */
function normalizeMarkdownHardBreaks(markdown: string): string {
  return markdown.replace(/\\(\r?\n)/g, '\n').replace(/ {2,}(\r?\n)/g, '\n');
}

/**
 * TipTap's Underline mark serializes as ++text++. Expand to `<u>` before `marked`
 * (skipping fenced code blocks so literal ++ in code is preserved).
 */
function expandTiptapUnderlineForMarked(markdown: string): string {
  const segments = markdown.split(/(```[\s\S]*?```)/g);
  return segments
    .map((segment) => {
      if (segment.startsWith('```')) return segment;
      return segment.replace(/\+\+([\s\S]+?)\+\+/g, '<u>$1</u>');
    })
    .join('');
}

/** marked emits `<del>` for GFM strikethrough; our allowlist uses `<s>`. */
function normalizeMarkedDelToStrike(html: string): string {
  return html.replace(/<\/?del\b([^>]*)>/gi, (tag) => tag.replace(/del/gi, 's'));
}

function preprocessMarkdownForMarked(markdown: string): string {
  return expandTiptapUnderlineForMarked(normalizeMarkdownHardBreaks(markdown));
}

/**
 * Strip markdown syntax to plain text; preserves paragraph breaks (does not collapse whitespace).
 */
function stripMarkdownSyntaxToPlainText(markdown: string): string {
  let text = normalizeMarkdownHardBreaks(markdown);
  text = text.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '').trim());
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  text = text.replace(/(\*\*\*|___)(.*?)\1/g, '$2');
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');
  text = text.replace(/\+\+([\s\S]+?)\+\+/g, '$1');
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  text = text.replace(/^\s{0,3}>\s?/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

const MARKDOWN_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'ol',
  'ul',
  'li',
  'blockquote',
  'h3',
  'h4',
  'code',
  'pre',
  'a',
  'hr',
  'img',
];

const MARKDOWN_ALLOWED_ATTR = [
  'href',
  'title',
  'target',
  'rel',
  'style',
  'src',
  'alt',
  'width',
  'height',
];
const MARKDOWN_ALLOWED_TAG_SET = new Set(MARKDOWN_ALLOWED_TAGS);
const MARKDOWN_VOID_TAGS = new Set(['br', 'hr', 'img']);

const MARKDOWN_INLINE_STYLES: Record<string, string> = {
  BLOCKQUOTE:
    'margin: 0.75rem 0; padding: 0.25rem 0.75rem 0.25rem 1rem; border-left: 3px solid rgba(57, 112, 77, 0.5); opacity: 0.9;',
  U: 'text-decoration: underline;',
  IMG: 'display:block;max-width:100%;height:auto;border:0;border-radius:8px;margin:12px 0;',
  UL: 'margin: 0.5rem 0; padding-left: 1.5rem;',
  OL: 'margin: 0.5rem 0; padding-left: 1.5rem;',
  LI: 'margin: 0.25rem 0;',
  P: 'margin: 0.5rem 0;',
};

let markedParser: Marked | null = null;

function getMarked(): Marked {
  if (!markedParser) {
    markedParser = new Marked({ gfm: true, breaks: true });
  }
  return markedParser;
}

function isSafeHref(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.startsWith('javascript:')) return false;
  if (trimmed.startsWith('data:') && !trimmed.startsWith('data:text/plain')) return false;
  if (trimmed.startsWith('vbscript:')) return false;
  return true;
}

function isSafeImageSrc(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
    return false;
  }
  if (lower.startsWith('https://')) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  return false;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function sanitizeAttrString(tagName: string, attrRaw: string): string {
  const attrs: string[] = [];
  const seen = new Set<string>();
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(attrRaw)) !== null) {
    const name = match[1].toLowerCase();
    if (name === 'class' || name === 'id' || !MARKDOWN_ALLOWED_ATTR.includes(name)) continue;
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    if (name === 'href' && !isSafeHref(value)) continue;
    if (name === 'src' && !isSafeImageSrc(value)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    attrs.push(`${name}="${escapeAttr(value)}"`);
  }
  if (tagName === 'img' && !seen.has('src')) {
    return '';
  }
  return attrs.join(' ');
}

function stripToAllowlistedHtml(html: string): string {
  const input = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');

  const parts: string[] = [];
  const stack: string[] = [];
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\s*([^>]*?)>|[^<]+/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(input)) !== null) {
    if (match[0].startsWith('<')) {
      const isClosing = match[1] === '/';
      const tagName = match[2].toLowerCase();
      const attrRaw = match[3] ?? '';
      const isVoid = MARKDOWN_VOID_TAGS.has(tagName) || /\/\s*$/.test(attrRaw);

      if (!MARKDOWN_ALLOWED_TAG_SET.has(tagName)) {
        if (isClosing) {
          const idx = stack.lastIndexOf(tagName);
          if (idx !== -1) {
            while (stack.length > idx) {
              parts.push(`</${stack.pop()}>`);
            }
          }
        }
        continue;
      }

      if (isClosing) {
        const idx = stack.lastIndexOf(tagName);
        if (idx !== -1) {
          while (stack.length > idx + 1) {
            parts.push(`</${stack.pop()}>`);
          }
          stack.pop();
          parts.push(`</${tagName}>`);
        }
      } else {
        const safeAttrs = sanitizeAttrString(tagName, attrRaw);
        if (tagName === 'img' && !safeAttrs) {
          continue;
        }
        const attrSuffix = safeAttrs ? ` ${safeAttrs}` : '';
        if (isVoid) {
          parts.push(`<${tagName}${attrSuffix}>`);
        } else {
          stack.push(tagName);
          parts.push(`<${tagName}${attrSuffix}>`);
        }
      }
    } else {
      parts.push(match[0]);
    }
  }
  while (stack.length) {
    parts.push(`</${stack.pop()}>`);
  }
  return enhanceSanitizedHtml(parts.join(''));
}

function enhanceSanitizedHtml(html: string): string {
  return html
    .replace(/<p(?![^>]*\bstyle=)([^>]*)>/gi, `<p style="${MARKDOWN_INLINE_STYLES['P']}"$1>`)
    .replace(/<ul(?![^>]*\bstyle=)([^>]*)>/gi, `<ul style="${MARKDOWN_INLINE_STYLES['UL']}"$1>`)
    .replace(/<ol(?![^>]*\bstyle=)([^>]*)>/gi, `<ol style="${MARKDOWN_INLINE_STYLES['OL']}"$1>`)
    .replace(/<li(?![^>]*\bstyle=)([^>]*)>/gi, `<li style="${MARKDOWN_INLINE_STYLES['LI']}"$1>`)
    .replace(
      /<blockquote(?![^>]*\bstyle=)([^>]*)>/gi,
      `<blockquote style="${MARKDOWN_INLINE_STYLES['BLOCKQUOTE']}"$1>`
    )
    .replace(/<u(?![^>]*\bstyle=)([^>]*)>/gi, `<u style="${MARKDOWN_INLINE_STYLES['U']}"$1>`)
    .replace(/<a\b([^>]*\bhref="([^"]*)"[^>]*)>/gi, (_match, rest: string, href: string) => {
      if (!isSafeHref(href)) return '<a>';
      let extra = '';
      if (!/\btarget=/.test(rest)) extra += ' target="_blank"';
      if (!/\brel=/.test(rest)) extra += ' rel="noopener noreferrer"';
      return `<a${rest}${extra}>`;
    })
    .replace(/<img\b([^>]*)>/gi, (_match, rest: string) => {
      const srcMatch = rest.match(/\bsrc="([^"]*)"/i);
      const src = srcMatch?.[1] ?? '';
      if (!isSafeImageSrc(src)) return '';
      let extra = '';
      if (!/\balt=/.test(rest)) extra += ' alt=""';
      if (!/\bstyle=/.test(rest)) extra += ` style="${MARKDOWN_INLINE_STYLES['IMG']}"`;
      return `<img${rest}${extra}>`;
    });
}

function markdownToSafeHtml(markdown: string | null | undefined): string {
  if (!markdown) return '';
  const preprocessed = preprocessMarkdownForMarked(String(markdown));
  const parsed = getMarked().parse(preprocessed, { async: false });
  const rawHtml = normalizeMarkedDelToStrike(
    typeof parsed === 'string' ? parsed : String(parsed)
  );
  return stripToAllowlistedHtml(rawHtml);
}

function markdownToPlainText(markdown: string | null | undefined): string {
  if (!markdown) return '';
  return stripMarkdownSyntaxToPlainText(String(markdown));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncateText(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

function buildPrayerUpdateBlockHtml(updateHtml: string): string {
  if (!updateHtml) return '';
  return `<p style="margin: 15px 0 10px 0;"><strong>Update</strong></p><div style="background-color:#ffffff;padding:15px;border-radius:6px;border-left:4px solid #3b82f6;margin:0;">${updateHtml}</div>`;
}

interface SpotlightEmailCandidate {
  kindLabel: string;
  title: string;
  prayerFor: string;
  requester: string;
  description: string;
}

interface SpotlightEmailTemplateVars {
  variablesText: Record<string, string>;
  variablesHtml: Record<string, string>;
}

const EMPTY_SPOTLIGHT_TEXT = {
  spotlightPrayerKind: '',
  spotlightPrayerTitle: '',
  spotlightPrayerFor: '',
  spotlightPrayerRequester: '',
  spotlightPrayerDescription: '',
  updateContent: '',
  spotlightUpdateTextSection: '',
};

const EMPTY_SPOTLIGHT_HTML = {
  spotlightPrayerKind: '',
  spotlightPrayerTitle: '',
  spotlightPrayerFor: '',
  spotlightPrayerRequester: '',
  spotlightPrayerDescription: '',
  spotlightPrayerDescriptionHtml: '',
  updateContent: '',
};

const SPOTLIGHT_DESCRIPTION_PLAIN_MAX = 600;
const SPOTLIGHT_UPDATE_PLAIN_MAX = 2000;

function buildSpotlightEmailTemplateVars(
  appLink: string,
  spotlight: SpotlightEmailCandidate | null,
  updateMarkdown: string
): SpotlightEmailTemplateVars {
  const updatePlain = truncateText(
    markdownToPlainText(updateMarkdown),
    SPOTLIGHT_UPDATE_PLAIN_MAX
  );
  const updateHtml = updatePlain ? markdownToSafeHtml(updateMarkdown) : '';
  const spotlightUpdateBlockHtml = buildPrayerUpdateBlockHtml(updateHtml);
  const spotlightLatestUpdateHtml = spotlightUpdateBlockHtml;
  const spotlightUpdateTextSection = updatePlain ? `\n\nLatest update:\n${updatePlain}\n` : '';

  if (!spotlight) {
    return {
      variablesText: {
        appLink,
        ...EMPTY_SPOTLIGHT_TEXT,
        spotlightUpdateBlockHtml: '',
        spotlightLatestUpdateHtml: '',
      },
      variablesHtml: {
        appLink,
        ...EMPTY_SPOTLIGHT_HTML,
        spotlightUpdateBlockHtml: '',
        spotlightLatestUpdateHtml: '',
      },
    };
  }

  const descriptionPlain = truncateText(
    markdownToPlainText(spotlight.description),
    SPOTLIGHT_DESCRIPTION_PLAIN_MAX
  );

  return {
    variablesText: {
      appLink,
      spotlightPrayerKind: spotlight.kindLabel,
      spotlightPrayerTitle: spotlight.title,
      spotlightPrayerFor: spotlight.prayerFor,
      spotlightPrayerRequester: spotlight.requester,
      spotlightPrayerDescription: descriptionPlain,
      updateContent: updatePlain,
      spotlightUpdateTextSection,
      spotlightUpdateBlockHtml: '',
      spotlightLatestUpdateHtml: '',
    },
    variablesHtml: {
      appLink,
      spotlightPrayerKind: escapeHtml(spotlight.kindLabel),
      spotlightPrayerTitle: escapeHtml(spotlight.title),
      spotlightPrayerFor: escapeHtml(spotlight.prayerFor),
      spotlightPrayerRequester: escapeHtml(spotlight.requester),
      spotlightPrayerDescription: escapeHtml(descriptionPlain),
      spotlightPrayerDescriptionHtml: markdownToSafeHtml(spotlight.description),
      updateContent: escapeHtml(updatePlain),
      spotlightUpdateBlockHtml,
      spotlightLatestUpdateHtml,
    },
  };
}
// ----- END inline edge-email-markdown -----
/**
 * Hourly job: send self prayer reminders.
 * Email when tenant_memberships.is_active !== false (matches UserSessionData.isActive).
 * Push when receive_push and a device_tokens row exists (matches receivePush + native token).
 * Both run when both are enabled.
 * Email body uses email_templates.user_hourly_prayer_reminder with {{appLink}} (same pattern as send-verification-code).
 * Set Edge secret APP_URL to match Angular environment.appUrl in production.
 * If APP_URL is host-only (no https://), it is prefixed with https:// so mail clients do not rewrite links to x-webdoc://…
 * Auth matches send-prayer-reminders: Supabase Edge JWT verification only.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Max-Age': '86400',
};

interface ReminderRow {
  id: string;
  user_email: string;
  iana_timezone: string;
  local_hour: number;
}

/** Absolute http(s) base for email <a href>; host-only values get https:// (avoids x-webdoc:// in Apple Mail). */
function normalizeAppUrl(raw: string | undefined, fallback: string): string {
  let u = (raw ?? fallback).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(u)) {
    if (/^localhost\b/i.test(u) || /^127\.0\.0\.1\b/.test(u)) {
      u = `http://${u}`;
    } else {
      u = `https://${u}`;
    }
  }
  return u;
}

/** When email_templates row is missing (migration not applied). */
function hourlyReminderFallbackParts(appLink: string, unsubscribeUrl: string): {
  subject: string;
  textBody: string;
  htmlBody: string;
} {
  const unsubText = unsubscribeUrl
    ? `\n\nUnsubscribe from these emails: ${unsubscribeUrl}\n`
    : '';
  const unsubHtml = unsubscribeUrl
    ? `<p style="margin-top:16px;font-size:12px;color:#6b7280;"><a href="${unsubscribeUrl}" style="color:#2563eb;">Unsubscribe from these emails</a></p>`
    : '';
  return {
    subject: 'Prayer reminder',
    textBody: `Take a moment to pray.\n\nOpen the app: ${appLink}\n${unsubText}`,
    htmlBody: `<p>Take a moment to pray.</p><p><a href="${appLink}">Open the prayer app</a></p>${unsubHtml}`,
  };
}

serve(async (req) => {
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

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const appUrl = normalizeAppUrl(Deno.env.get('APP_URL'), 'http://localhost:4200');
  const appLink = `${appUrl}/`;
  const supabasePublic = supabaseUrl.replace(/\/+$/, '');
  const pushTitle = 'Prayer reminder';
  const pushBody = 'Take a moment to pray.';

  try {
    const { data: dueRows, error: rpcError } = await supabase.rpc(
      'get_user_prayer_hour_reminders_due_now'
    );

    if (rpcError) {
      console.error('RPC get_user_prayer_hour_reminders_due_now failed:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Failed to load due reminders', details: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rows = (dueRows ?? []) as ReminderRow[];
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No user prayer reminders due this hour',
          matched: 0,
          pushesSent: 0,
          emailsSent: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: hourlyTemplate } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_key', 'user_hourly_prayer_reminder')
      .maybeSingle();

    if (!hourlyTemplate) {
      console.warn(
        'email_templates.user_hourly_prayer_reminder not found; using inline fallback. Run migration or add template in admin.'
      );
    }

    const byLower = new Map<string, string>();
    for (const r of rows) {
      const k = r.user_email.toLowerCase();
      if (!byLower.has(k)) byLower.set(k, r.user_email);
    }
    const uniqueEmails = [...byLower.values()];

    const { data: subscribers, error: subErr } = await supabase
      .from('tenant_memberships')
      .select('user_email, receive_push, is_active, is_blocked, unsubscribe_token')
      .in('user_email', uniqueEmails);

    if (subErr) {
      console.error('tenant_memberships batch failed:', subErr);
      return new Response(
        JSON.stringify({ error: 'Failed to load subscribers', details: subErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subByLower = new Map(
      (subscribers ?? []).map((s: { user_email: string }) => [s.user_email.toLowerCase(), s])
    );

    const { data: tokenRows, error: tokErr } = await supabase
      .from('device_tokens')
      .select('user_email')
      .in('user_email', uniqueEmails);

    if (tokErr) {
      console.error('device_tokens batch failed:', tokErr);
      return new Response(
        JSON.stringify({ error: 'Failed to load device tokens', details: tokErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasToken = new Set(
      (tokenRows ?? []).map((t: { user_email: string }) => t.user_email.toLowerCase())
    );

    let pushesSent = 0;
    let emailsSent = 0;
    const errors: string[] = [];

    for (const canonicalEmail of uniqueEmails) {
      const sub = subByLower.get(canonicalEmail.toLowerCase()) as
        | {
          user_email: string;
          receive_push: boolean | null;
          is_active: boolean | null;
          is_blocked: boolean | null;
          unsubscribe_token: string;
        }
        | undefined;

      if (!sub || sub.is_blocked) {
        continue;
      }

      const recipient = sub.user_email;
      const lower = recipient.toLowerCase();
      // Align with UserSessionService: is_active ?? true for "email subscription"
      const wantEmail = sub.is_active !== false;
      const wantPush = !!sub.receive_push && hasToken.has(lower);

      if (!wantEmail && !wantPush) {
        continue;
      }

      if (wantPush) {
        const { error: pushErr } = await supabase.functions.invoke('send-push-notification', {
          body: {
            emails: [recipient],
            title: pushTitle,
            body: pushBody,
            data: {
              type: 'prayer_reminder',
              url: appLink,
            },
          },
        });
        if (pushErr) {
          console.error('Push failed for', recipient, pushErr);
          errors.push(`${recipient} push: ${pushErr.message ?? String(pushErr)}`);
        } else {
          pushesSent++;
        }
      }

      if (wantEmail) {
        const unsubTok = sub.unsubscribe_token?.trim() ?? '';
        const appBase = appUrl.replace(/\/+$/, '');
        const unsubscribeUrl = unsubTok
          ? `${appBase}/unsubscribe?token=${encodeURIComponent(unsubTok)}`
          : '';
        const listUnsubscribeHttpsUrl = unsubTok
          ? `${supabasePublic}/functions/v1/email-unsubscribe?token=${
            encodeURIComponent(unsubTok)
          }`
          : undefined;

        const variables: Record<string, string> = {
          appLink,
          unsubscribe_url: unsubscribeUrl,
        };
        let subject: string;
        let textBody: string;
        let htmlBody: string;
        if (hourlyTemplate) {
          subject = applyTemplateVariables(hourlyTemplate.subject, variables);
          textBody = applyTemplateVariables(hourlyTemplate.text_body, variables);
          htmlBody = applyTemplateVariables(hourlyTemplate.html_body, variables);
        } else {
          const fb = hourlyReminderFallbackParts(appLink, unsubscribeUrl);
          subject = fb.subject;
          textBody = fb.textBody;
          htmlBody = fb.htmlBody;
        }

        const { error: mailErr } = await supabase.functions.invoke('send-email', {
          body: {
            to: recipient,
            subject,
            textBody,
            htmlBody,
            ...(listUnsubscribeHttpsUrl
              ? { listUnsubscribeHttpsUrl }
              : {}),
          },
        });
        if (mailErr) {
          console.error('Email failed for', recipient, mailErr);
          errors.push(`${recipient} email: ${mailErr.message ?? String(mailErr)}`);
        } else {
          emailsSent++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Hourly user prayer reminders processed',
        matched: uniqueEmails.length,
        rowCount: rows.length,
        pushesSent,
        emailsSent,
        errors: errors.length ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('send-user-hourly-prayer-reminders:', e);
    return new Response(
      JSON.stringify({
        error: 'Unexpected error',
        details: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Replace template variables with actual values
 * Supports {{variableName}} syntax
 */
function applyTemplateVariables(content: string, variables: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}
