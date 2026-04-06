/**
 * Processes pending rows in public.email_queue via Resend.
 * Replaces the previous GitHub Actions dispatch so mass / approval emails work without GITHUB_PAT.
 *
 * Env (same as send-email): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 * MAIL_SENDER_ADDRESS, optional MAIL_FROM_NAME.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Max-Age": "86400",
};

const BATCH_SIZE = 20;
/** Cap work per invocation to stay within Edge timeouts */
const MAX_BATCHES_PER_INVOCATION = 12;
const MAX_RETRIES = 5;
const RESEND_API = "https://api.resend.com";

interface EmailQueueItem {
  id: string;
  recipient: string;
  template_key: string;
  template_variables: Record<string, string | null | undefined>;
  attempts: number;
  tenant_id?: string | null;
}

interface EmailTemplate {
  template_key: string;
  subject: string;
  html_body: string;
  text_body: string;
}

function applyTemplateVariables(
  content: string,
  variables: Record<string, string | null | undefined>,
): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    const stringValue =
      value !== null && value !== undefined ? String(value) : "";
    result = result.replace(placeholder, stringValue);
  }
  return result;
}

function buildFromHeader(mailFromName: string, mailSender: string): string {
  return `${mailFromName} <${mailSender}>`;
}

function listUnsubscribeHeaders(
  mailSender: string,
  listUnsubscribeHttpsUrl?: string,
): Record<string, string> {
  const mailto = `<mailto:${mailSender}?subject=unsubscribe>`;
  const u = listUnsubscribeHttpsUrl?.trim();
  if (u) {
    return {
      "List-Unsubscribe": `<${u}>, ${mailto}`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }
  return { "List-Unsubscribe": mailto };
}

function oneClickUnsubscribeUrl(supabaseUrl: string, token: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/functions/v1/email-unsubscribe?token=${
    encodeURIComponent(token)
  }`;
}

async function sendViaResend(
  recipient: string,
  subject: string,
  htmlBody: string,
  textBody: string,
  resendKey: string,
  mailSender: string,
  mailFromName: string,
  listUnsubscribeHttpsUrl?: string,
): Promise<void> {
  const payload: Record<string, unknown> = {
    from: buildFromHeader(mailFromName, mailSender),
    to: [recipient],
    subject,
    headers: listUnsubscribeHeaders(mailSender, listUnsubscribeHttpsUrl),
  };
  if (htmlBody) {
    payload.html = htmlBody;
    if (textBody) payload.text = textBody;
  } else {
    payload.text = textBody || "";
  }

  const response = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${error}`);
  }
}

async function lockEmails(
  supabase: ReturnType<typeof createClient>,
  emailIds: string[],
): Promise<void> {
  if (emailIds.length === 0) return;
  const { error } = await supabase
    .from("email_queue")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
    })
    .in("id", emailIds);
  if (error) throw new Error(`Failed to lock emails: ${error.message}`);
}

function templateCacheKey(
  tenantId: string | null | undefined,
  templateKey: string,
): string {
  return `${tenantId ?? "default"}::${templateKey}`;
}

async function getDefaultTenantId(
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "default-tenant")
    .maybeSingle();
  if (error) {
    console.warn("default tenant lookup failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

async function prefetchTemplatesForBatch(
  supabase: ReturnType<typeof createClient>,
  items: EmailQueueItem[],
  cache: Map<string, EmailTemplate>,
  defaultTenantId: string | null,
): Promise<void> {
  const needed = new Map<string, Set<string>>();
  for (const item of items) {
    const tid = item.tenant_id ?? defaultTenantId;
    if (!tid) {
      throw new Error(
        `Queue item ${item.id} has no tenant_id and default tenant is unknown`,
      );
    }
    const k = templateCacheKey(tid, item.template_key);
    if (cache.has(k)) continue;
    if (!needed.has(tid)) needed.set(tid, new Set());
    needed.get(tid)!.add(item.template_key);
  }

  for (const [tenantId, keySet] of needed) {
    const keysToFetch = [...keySet];
    if (keysToFetch.length === 0) continue;

    const { data, error } = await supabase
      .from("email_templates")
      .select("template_key, subject, html_body, text_body")
      .eq("tenant_id", tenantId)
      .in("template_key", keysToFetch);

    if (error) throw new Error(`Template fetch failed: ${error.message}`);
    if (!data?.length) {
      throw new Error(
        `No templates for tenant ${tenantId} keys: ${keysToFetch.join(", ")}`,
      );
    }

    const fetched = new Set(data.map((t) => t.template_key));
    const missing = keysToFetch.filter((k) => !fetched.has(k));
    if (missing.length > 0) {
      throw new Error(
        `Missing email_templates rows for tenant ${tenantId}: ${missing.join(", ")}`,
      );
    }

    for (const row of data) {
      cache.set(
        templateCacheKey(tenantId, row.template_key),
        row as EmailTemplate,
      );
    }
  }
}

async function processOne(
  supabase: ReturnType<typeof createClient>,
  email: EmailQueueItem,
  cache: Map<string, EmailTemplate>,
  resendKey: string,
  mailSender: string,
  mailFromName: string,
  supabaseUrl: string,
  defaultTenantId: string | null,
): Promise<boolean> {
  try {
    const tid = email.tenant_id ?? defaultTenantId;
    if (!tid) {
      throw new Error(`No tenant for queue item ${email.id}`);
    }
    const cacheKey = templateCacheKey(tid, email.template_key);
    const template = cache.get(cacheKey);
    if (!template) {
      throw new Error(`Template not in cache: ${cacheKey}`);
    }

    const subject = applyTemplateVariables(
      template.subject,
      email.template_variables,
    );
    const htmlBody = applyTemplateVariables(
      template.html_body,
      email.template_variables,
    );
    const textBody = applyTemplateVariables(
      template.text_body,
      email.template_variables,
    );

    const rawTok = email.template_variables?.unsubscribe_token;
    const token =
      rawTok !== null && rawTok !== undefined && String(rawTok).trim() !== ""
        ? String(rawTok).trim()
        : undefined;
    const listUnsubscribeHttpsUrl =
      token && supabaseUrl
        ? oneClickUnsubscribeUrl(supabaseUrl, token)
        : undefined;

    await sendViaResend(
      email.recipient,
      subject,
      htmlBody,
      textBody,
      resendKey,
      mailSender,
      mailFromName,
      listUnsubscribeHttpsUrl,
    );

    const { error: delErr } = await supabase
      .from("email_queue")
      .delete()
      .eq("id", email.id);
    if (delErr) throw delErr;
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const attempts = email.attempts + 1;
    console.error(`Queue item ${email.id} failed:`, message);

    if (attempts < MAX_RETRIES) {
      await supabase
        .from("email_queue")
        .update({
          status: "pending",
          attempts,
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", email.id);
      return false;
    }

    await supabase.from("email_queue").delete().eq("id", email.id);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const mailSender = Deno.env.get("MAIL_SENDER_ADDRESS");
    const mailFromName = Deno.env.get("MAIL_FROM_NAME") || "Prayer Ministry";

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Supabase not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!resendKey || !mailSender) {
      return new Response(
        JSON.stringify({
          error:
            "RESEND_API_KEY and MAIL_SENDER_ADDRESS must be set for the email processor",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const supabasePublicUrl = supabaseUrl.replace(/\/+$/, "");
    const templateCache = new Map<string, EmailTemplate>();
    const defaultTenantId = await getDefaultTenantId(supabase);

    let totalSent = 0;
    let totalFailed = 0;
    let batches = 0;
    let stoppedByCap = false;

    while (batches < MAX_BATCHES_PER_INVOCATION) {
      batches++;
      const { data: queueItems, error: fetchError } = await supabase
        .from("email_queue")
        .select(
          "id, recipient, template_key, template_variables, attempts, tenant_id",
        )
        .eq("status", "pending")
        .lt("attempts", MAX_RETRIES)
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);

      if (fetchError) {
        throw new Error(`Queue fetch failed: ${fetchError.message}`);
      }

      if (!queueItems?.length) {
        break;
      }

      const ids = queueItems.map((r: EmailQueueItem) => r.id);
      await lockEmails(supabase, ids);

      await prefetchTemplatesForBatch(
        supabase,
        queueItems as EmailQueueItem[],
        templateCache,
        defaultTenantId,
      );

      for (const row of queueItems as EmailQueueItem[]) {
        const ok = await processOne(
          supabase,
          row,
          templateCache,
          resendKey,
          mailSender,
          mailFromName,
          supabasePublicUrl,
          defaultTenantId,
        );
        if (ok) totalSent++;
        else totalFailed++;
        await new Promise((r) => setTimeout(r, 100));
      }

      if (queueItems.length < BATCH_SIZE) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    const { count: pendingAfter } = await supabase
      .from("email_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("attempts", MAX_RETRIES);

    if ((pendingAfter ?? 0) > 0 && batches >= MAX_BATCHES_PER_INVOCATION) {
      stoppedByCap = true;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email queue processed",
        sent: totalSent,
        failedOrRetry: totalFailed,
        batches,
        pendingRemaining: pendingAfter ?? 0,
        stoppedByCap,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("trigger-email-processor error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process email queue",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
