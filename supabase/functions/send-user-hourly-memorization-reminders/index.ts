/**
 * Hourly job: send self memorization reminders.
 * Email when tenant_memberships.is_active !== false; push when receive_push + device_tokens.
 * Template: tenant_settings.user_hourly_memorization_reminder_template_key → email_templates (per tenant).
 * Spotlight template fills {{spotlightItemReference}}, {{spotlightItemKind}}, {{spotlightMasteryLevel}},
 * {{spotlightVerseText}}, {{spotlightBlockHtml}} (empty when user has no memorized items).
 * Spotlight picks the item needing the most work (learning tier, least recently practiced, fewest sessions).
 * Set Edge secret APP_URL to match Angular environment.appUrl in production.
 * Spotlight selection logic is duplicated from src/app/lib/memorization/memorization-reminder-spotlight.ts
 * (single-file bundle required for Supabase Edge deploy; keep both in sync).
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_HOURLY_TEMPLATE_KEY = 'user_hourly_memorization_reminder';
const SPOTLIGHT_TEMPLATE_KEY = 'user_hourly_memorization_reminder_with_spotlight';

interface ReminderRow {
  id: string;
  user_email: string;
  tenant_id: string;
  iana_timezone: string;
  local_hour: number;
}

interface EmailTemplateRow {
  subject: string;
  text_body: string;
  html_body: string;
}

interface MemorizedItemRow {
  id: string;
  reference: string;
  text: string;
  translation: string;
  kind: 'verse' | 'bibleBooks';
  last_practiced_at: string | null;
  practice_sessions: Array<{ completed?: boolean }> | null;
}

interface SpotlightResult {
  id: string;
  reference: string;
  kindLabel: string;
  masteryLevel: string;
  verseText: string;
}

interface MemorizationSpotlightCandidate {
  id: string;
  reference: string;
  kind: 'verse' | 'bibleBooks';
  completedSessions: number;
  lastPracticedAt: string | null;
}

type MasteryTier = 0 | 1 | 2;

function masteryTierFromCompletedCount(completedCount: number): MasteryTier {
  if (completedCount < 3) return 0;
  if (completedCount < 9) return 1;
  return 2;
}

function masteryLevelLabel(tier: MasteryTier): string {
  switch (tier) {
    case 0:
      return 'Learning';
    case 1:
      return 'Practicing';
    case 2:
      return 'Mastered';
    default:
      return 'Learning';
  }
}

function kindLabelForMemorizedItem(kind: 'verse' | 'bibleBooks'): string {
  return kind === 'bibleBooks' ? 'Bible books' : 'Verse';
}

function compareSpotlightCandidates(
  a: MemorizationSpotlightCandidate,
  b: MemorizationSpotlightCandidate
): number {
  const tierA = masteryTierFromCompletedCount(a.completedSessions);
  const tierB = masteryTierFromCompletedCount(b.completedSessions);
  if (tierA !== tierB) return tierA - tierB;

  const lastA = a.lastPracticedAt ? Date.parse(a.lastPracticedAt) : null;
  const lastB = b.lastPracticedAt ? Date.parse(b.lastPracticedAt) : null;
  if (lastA === null && lastB !== null) return -1;
  if (lastA !== null && lastB === null) return 1;
  if (lastA !== null && lastB !== null && lastA !== lastB) return lastA - lastB;

  if (a.completedSessions !== b.completedSessions) {
    return a.completedSessions - b.completedSessions;
  }

  return a.reference.localeCompare(b.reference);
}

function sameSpotlightPriority(
  a: MemorizationSpotlightCandidate,
  b: MemorizationSpotlightCandidate
): boolean {
  const tierA = masteryTierFromCompletedCount(a.completedSessions);
  const tierB = masteryTierFromCompletedCount(b.completedSessions);
  if (tierA !== tierB) return false;

  const lastA = a.lastPracticedAt ? Date.parse(a.lastPracticedAt) : null;
  const lastB = b.lastPracticedAt ? Date.parse(b.lastPracticedAt) : null;
  return lastA === lastB && a.completedSessions === b.completedSessions;
}

function pickMemorizationSpotlightCandidate(
  items: MemorizationSpotlightCandidate[],
  lastSpotlightId: string | null
): MemorizationSpotlightCandidate | null {
  if (items.length === 0) return null;

  const sorted = [...items].sort(compareSpotlightCandidates);
  const best = sorted[0];
  const tied = sorted.filter((item) => sameSpotlightPriority(item, best));

  if (tied.length === 1) return tied[0];

  if (lastSpotlightId) {
    const alternate = tied.filter((item) => item.id !== lastSpotlightId);
    if (alternate.length > 0) return alternate[0];
  }

  return tied[0];
}

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

function hourlyReminderFallbackParts(appLink: string): {
  subject: string;
  textBody: string;
  htmlBody: string;
} {
  return {
    subject: 'Memorization reminder',
    textBody: `Take a moment to practice your verses.\n\nOpen the app: ${appLink}\n`,
    htmlBody: `<p>Take a moment to practice your verses.</p><p><a href="${appLink}">Open the Memorize tab</a></p>`,
  };
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
  return `${s.slice(0, maxLen - 1)}...`;
}

function countCompletedSessions(
  sessions: Array<{ completed?: boolean }> | null | undefined
): number {
  return (sessions ?? []).filter((s) => s.completed === true).length;
}

function buildSpotlightBlockHtml(spotlight: SpotlightResult | null): string {
  if (!spotlight) return '';
  const textHtml = spotlight.verseText
    ? `<div style="background-color:#ecfdf5;padding:15px;border-radius:6px;border-left:4px solid #10b981;margin:15px 0 0;"><p style="margin:0;white-space:pre-wrap;">${escapeHtml(
        truncateText(spotlight.verseText, 1200)
      )}</p></div>`
    : '';
  return `<h2 style="color:#1f2937;margin-top:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${escapeHtml(
    spotlight.reference
  )}</h2><p style="margin:5px 0 15px 0;"><strong>${escapeHtml(
    spotlight.kindLabel
  )}</strong> · <strong>${escapeHtml(spotlight.masteryLevel)}</strong></p>${textHtml}`;
}

function applyTemplateVariables(content: string, variables: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'g'), value ?? '');
  }
  return result;
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

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const appUrl = normalizeAppUrl(Deno.env.get('APP_URL'), 'http://localhost:4200');
  const appLink = `${appUrl}/?filter=memorize`;
  const pushTitle = 'Memorization reminder';

  try {
    const { data: dueRows, error: rpcError } = await supabase.rpc(
      'get_user_memorization_hour_reminders_due_now'
    );

    if (rpcError) {
      console.error('RPC get_user_memorization_hour_reminders_due_now failed:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Failed to load due reminders', details: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rows = (dueRows ?? []) as ReminderRow[];
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No user memorization reminders due this hour',
          matched: 0,
          pushesSent: 0,
          emailsSent: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uniqueEmails = [...new Set(rows.map((r) => r.user_email))];
    const tenantIds = [...new Set(rows.map((r) => r.tenant_id))];

    const { data: memberships, error: subErr } = await supabase
      .from('tenant_memberships')
      .select(
        'user_email, tenant_id, receive_push, is_active, is_blocked, unsubscribe_token, hourly_memorization_reminder_last_spotlight_key'
      )
      .in('user_email', uniqueEmails)
      .in('tenant_id', tenantIds);

    if (subErr) {
      console.error('tenant_memberships batch failed:', subErr);
      return new Response(
        JSON.stringify({ error: 'Failed to load memberships', details: subErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const membershipKey = (email: string, tenantId: string) =>
      `${email.toLowerCase()}::${tenantId}`;
    const membershipByKey = new Map(
      (memberships ?? []).map((s: { user_email: string; tenant_id: string }) => [
        membershipKey(s.user_email, s.tenant_id),
        s,
      ])
    );

    const { data: tenantSettingsRows, error: settingsErr } = await supabase
      .from('tenant_settings')
      .select('tenant_id, user_hourly_memorization_reminder_template_key')
      .in('tenant_id', tenantIds);

    if (settingsErr) {
      console.error('tenant_settings batch failed:', settingsErr);
    }

    const templateKeyByTenant = new Map<string, string>();
    for (const row of tenantSettingsRows ?? []) {
      const r = row as {
        tenant_id: string;
        user_hourly_memorization_reminder_template_key?: string;
      };
      templateKeyByTenant.set(
        r.tenant_id,
        r.user_hourly_memorization_reminder_template_key ?? DEFAULT_HOURLY_TEMPLATE_KEY
      );
    }

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

    const supabasePublic = supabaseUrl.replace(/\/+$/, '');
    let pushesSent = 0;
    let emailsSent = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const sub = membershipByKey.get(membershipKey(row.user_email, row.tenant_id)) as
        | {
            user_email: string;
            tenant_id: string;
            receive_push: boolean | null;
            is_active: boolean | null;
            is_blocked: boolean | null;
            unsubscribe_token?: string | null;
            hourly_memorization_reminder_last_spotlight_key?: string | null;
          }
        | undefined;

      if (!sub || sub.is_blocked) {
        continue;
      }

      const recipient = sub.user_email;
      const lower = recipient.toLowerCase();
      const wantEmail = sub.is_active !== false;
      const wantPush = !!sub.receive_push && hasToken.has(lower);

      if (!wantEmail && !wantPush) {
        continue;
      }

      const activeTemplateKey =
        templateKeyByTenant.get(row.tenant_id) ?? DEFAULT_HOURLY_TEMPLATE_KEY;
      const useSpotlightVariables = activeTemplateKey === SPOTLIGHT_TEMPLATE_KEY;

      const { data: hourlyTemplate } = await supabase
        .from('email_templates')
        .select('subject, text_body, html_body')
        .eq('tenant_id', row.tenant_id)
        .eq('template_key', activeTemplateKey)
        .maybeSingle();

      let spotlight: SpotlightResult | null = null;
      if (useSpotlightVariables) {
        spotlight = await loadSpotlightForRecipient(
          supabase,
          recipient,
          row.tenant_id,
          sub.hourly_memorization_reminder_last_spotlight_key ?? null
        );
      }

      const spotlightBlockHtml = buildSpotlightBlockHtml(spotlight);

      const spotlightPlain = spotlight
        ? {
            spotlightItemReference: spotlight.reference,
            spotlightItemKind: spotlight.kindLabel,
            spotlightMasteryLevel: spotlight.masteryLevel,
            spotlightVerseText: truncateText(spotlight.verseText, 1200),
          }
        : {
            spotlightItemReference: '',
            spotlightItemKind: '',
            spotlightMasteryLevel: '',
            spotlightVerseText: '',
          };

      const spotlightSafeHtml = spotlight
        ? {
            spotlightItemReference: escapeHtml(spotlight.reference),
            spotlightItemKind: escapeHtml(spotlight.kindLabel),
            spotlightMasteryLevel: escapeHtml(spotlight.masteryLevel),
            spotlightVerseText: escapeHtml(truncateText(spotlight.verseText, 1200)),
          }
        : {
            spotlightItemReference: '',
            spotlightItemKind: '',
            spotlightMasteryLevel: '',
            spotlightVerseText: '',
          };

      const variablesHtml: Record<string, string> = {
        appLink,
        ...spotlightSafeHtml,
        spotlightBlockHtml,
      };
      const variablesText: Record<string, string> = {
        appLink,
        ...spotlightPlain,
        spotlightBlockHtml: '',
      };

      const pushBody =
        spotlight && useSpotlightVariables
          ? truncateText(`${spotlight.reference} — ${spotlight.masteryLevel}`, 140)
          : 'Take a moment to practice your verses.';

      let pushDelivered = false;
      if (wantPush) {
        const { error: pushErr } = await supabase.functions.invoke('send-push-notification', {
          body: {
            emails: [recipient],
            title: pushTitle,
            body: pushBody,
            data: {
              type: 'memorization_reminder',
              url: appLink,
            },
          },
        });
        if (pushErr) {
          console.error('Push failed for', recipient, pushErr);
          errors.push(`${recipient} push: ${pushErr.message ?? String(pushErr)}`);
        } else {
          pushesSent++;
          pushDelivered = true;
        }
      }

      let emailDelivered = false;
      if (wantEmail) {
        const unsubTok = sub.unsubscribe_token?.trim() ?? '';
        const appBase = appUrl.replace(/\/+$/, '');
        const unsubscribeUrl = unsubTok
          ? `${appBase}/unsubscribe?token=${encodeURIComponent(unsubTok)}`
          : '';
        const listUnsubscribeHttpsUrl = unsubTok
          ? `${supabasePublic}/functions/v1/email-unsubscribe?token=${encodeURIComponent(unsubTok)}`
          : undefined;

        variablesText.unsubscribe_url = unsubscribeUrl;
        variablesHtml.unsubscribe_url = unsubscribeUrl;

        let subject: string;
        let textBody: string;
        let htmlBody: string;
        if (hourlyTemplate) {
          subject = applyTemplateVariables(hourlyTemplate.subject, variablesText);
          textBody = applyTemplateVariables(hourlyTemplate.text_body, variablesText);
          htmlBody = applyTemplateVariables(hourlyTemplate.html_body, variablesHtml);
        } else {
          const fb = hourlyReminderFallbackParts(appLink);
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
            ...(listUnsubscribeHttpsUrl ? { listUnsubscribeHttpsUrl } : {}),
          },
        });
        if (mailErr) {
          console.error('Email failed for', recipient, mailErr);
          errors.push(`${recipient} email: ${mailErr.message ?? String(mailErr)}`);
        } else {
          emailsSent++;
          emailDelivered = true;
        }
      }

      if (useSpotlightVariables && (pushDelivered || emailDelivered)) {
        const nextKey = spotlight?.id ?? null;
        const { error: spotErr } = await supabase
          .from('tenant_memberships')
          .update({ hourly_memorization_reminder_last_spotlight_key: nextKey })
          .eq('user_email', recipient)
          .eq('tenant_id', row.tenant_id);
        if (spotErr) {
          console.error(
            'hourly_memorization_reminder_last_spotlight_key update failed',
            recipient,
            spotErr
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Hourly user memorization reminders processed',
        matched: rows.length,
        rowCount: rows.length,
        pushesSent,
        emailsSent,
        errors: errors.length ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('send-user-hourly-memorization-reminders:', e);
    return new Response(
      JSON.stringify({
        error: 'Unexpected error',
        details: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function loadSpotlightForRecipient(
  supabase: SupabaseClient<any>,
  recipientEmail: string,
  tenantId: string,
  lastSpotlightId: string | null
): Promise<SpotlightResult | null> {
  const { data: rows, error } = await supabase
    .from('memorized_items')
    .select('id, reference, text, translation, kind, last_practiced_at, practice_sessions')
    .ilike('user_email', recipientEmail)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('memorized_items query failed', error);
    return null;
  }

  const candidates: MemorizationSpotlightCandidate[] = (rows ?? []).map(
    (row: MemorizedItemRow) => ({
      id: row.id,
      reference: row.reference,
      kind: row.kind,
      completedSessions: countCompletedSessions(row.practice_sessions),
      lastPracticedAt: row.last_practiced_at,
    })
  );

  const picked = pickMemorizationSpotlightCandidate(candidates, lastSpotlightId);
  if (!picked) return null;

  const row = (rows ?? []).find((r: MemorizedItemRow) => r.id === picked.id) as
    | MemorizedItemRow
    | undefined;
  if (!row) return null;

  let verseText = '';
  if (row.kind === 'bibleBooks') {
    verseText = row.text?.trim() ?? '';
  } else {
    const { data: cached, error: cacheErr } = await supabase
      .from('scripture_cache')
      .select('text')
      .eq('reference', row.reference)
      .eq('translation', row.translation || 'esv')
      .maybeSingle();
    if (cacheErr) {
      console.error('scripture_cache lookup failed', cacheErr);
    }
    verseText = (cached as { text?: string } | null)?.text?.trim() ?? '';
  }

  const tier = masteryTierFromCompletedCount(picked.completedSessions);

  return {
    id: picked.id,
    reference: picked.reference,
    kindLabel: kindLabelForMemorizedItem(picked.kind),
    masteryLevel: masteryLevelLabel(tier),
    verseText,
  };
}
