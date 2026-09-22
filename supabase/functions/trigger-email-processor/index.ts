/**
 * Processes pending rows in public.email_queue via Resend POST /emails/batch.
 * One recipient per message (no BCC / multi-recipient To). Up to RESEND_BATCH_SIZE
 * per request; RESEND_INTER_BATCH_PAUSE_MS between batch HTTP calls.
 *
 * Replaces the previous GitHub Actions dispatch so mass / approval emails work without GITHUB_PAT.
 * Payload helpers aligned with src/lib/resend-batch.ts (inlined for Edge deploy).
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

/** Resend batch endpoint: max emails per request */
const RESEND_BATCH_SIZE = 100;
/** Pause between batch HTTP requests */
const RESEND_INTER_BATCH_PAUSE_MS = 250;
/** Default wait when Resend returns 429 without Retry-After */
const RESEND_429_DEFAULT_WAIT_MS = 5000;
/** Cap batch HTTP rounds per invocation to stay within Edge timeouts */
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

interface ResendBatchItemError {
  index: number;
  message: string;
}

type BatchIndexOutcome = "success" | "failure";

interface ClassifiedBatchResult {
  outcomes: BatchIndexOutcome[];
  requestLevelFailure: boolean;
  message?: string;
}

function buildResendEmailObject(input: {
  fromHeader: string;
  recipient: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  replyTo?: string;
  listUnsubscribeHeaders: Record<string, string>;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    from: input.fromHeader,
    to: [input.recipient],
    subject: input.subject,
    headers: input.listUnsubscribeHeaders,
  };
  if (input.replyTo) payload.reply_to = input.replyTo;
  if (input.htmlBody) {
    payload.html = input.htmlBody;
    if (input.textBody) payload.text = input.textBody;
  } else {
    payload.text = input.textBody || "";
  }
  return payload;
}

function classifyResendBatchResult(params: {
  httpOk: boolean;
  status: number;
  chunkLength: number;
  errors?: ResendBatchItemError[] | null;
  responseBody?: string;
}): ClassifiedBatchResult {
  const { httpOk, chunkLength, errors, responseBody } = params;

  if (chunkLength <= 0) {
    return { outcomes: [], requestLevelFailure: false };
  }

  if (!httpOk) {
    return {
      outcomes: Array.from({ length: chunkLength }, () => "failure"),
      requestLevelFailure: true,
      message: responseBody?.trim() || `HTTP ${params.status}`,
    };
  }

  if (!errors?.length) {
    return {
      outcomes: Array.from({ length: chunkLength }, () => "success"),
      requestLevelFailure: false,
    };
  }

  const failed = new Set<number>();
  for (const err of errors) {
    if (
      Number.isInteger(err.index) &&
      err.index >= 0 &&
      err.index < chunkLength
    ) {
      failed.add(err.index);
    }
  }

  const outcomes: BatchIndexOutcome[] = [];
  for (let i = 0; i < chunkLength; i++) {
    outcomes.push(failed.has(i) ? "failure" : "success");
  }

  return {
    outcomes,
    requestLevelFailure: false,
    message: errors.map((e) => `[${e.index}] ${e.message}`).join("; "),
  };
}

function resend429DelayMs(retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!Number.isNaN(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }
  return RESEND_429_DEFAULT_WAIT_MS;
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

const MAIL_FROM_LOCAL_PART_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const MAIL_REPLY_TO_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

interface MailIdentity {
  fromHeader: string;
  fromAddress: string;
  replyTo?: string;
}

function platformDomainFromSenderAddress(senderAddress: string): string | null {
  const trimmed = senderAddress.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const domain = trimmed.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

function coerceMailFromLocalPart(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v || !MAIL_FROM_LOCAL_PART_PATTERN.test(v)) return null;
  return v;
}

function coerceMailFromName(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v || v.length > 78 || /[<>\r\n]/.test(v)) return null;
  return v;
}

function coerceMailReplyTo(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v || v.length > 254 || /[\r\n<>]/.test(v) || !MAIL_REPLY_TO_PATTERN.test(v)) {
    return null;
  }
  return v.toLowerCase();
}

function platformMailIdentity(mailFromName: string, mailSender: string): MailIdentity {
  return {
    fromHeader: `${mailFromName} <${mailSender}>`,
    fromAddress: mailSender,
  };
}

function tenantMailIdentity(
  mailFromName: string,
  mailSender: string,
  row: {
    mail_from_name?: string | null;
    mail_from_local_part?: string | null;
    mail_reply_to?: string | null;
  } | null,
): MailIdentity {
  const domain = platformDomainFromSenderAddress(mailSender);
  const fromName = coerceMailFromName(row?.mail_from_name) || mailFromName;
  const localPart = coerceMailFromLocalPart(row?.mail_from_local_part);
  const fromAddress = domain && localPart ? `${localPart}@${domain}` : mailSender;
  const replyTo = coerceMailReplyTo(row?.mail_reply_to);
  return {
    fromHeader: `${fromName} <${fromAddress}>`,
    fromAddress,
    replyTo: replyTo || undefined,
  };
}

async function resolveQueueMailIdentity(
  supabase: ReturnType<typeof createClient>,
  tenantId: string | null | undefined,
  mailFromName: string,
  mailSender: string,
  cache: Map<string, MailIdentity>,
): Promise<MailIdentity> {
  const fallback = platformMailIdentity(mailFromName, mailSender);
  const tid = tenantId?.trim() ?? "";
  if (!tid) return fallback;
  const cached = cache.get(tid);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("tenant_settings")
    .select("mail_from_name, mail_from_local_part, mail_reply_to")
    .eq("tenant_id", tid)
    .maybeSingle();
  if (error) {
    console.warn("tenant mail identity lookup failed:", error.message);
    cache.set(tid, fallback);
    return fallback;
  }
  const identity = tenantMailIdentity(mailFromName, mailSender, data);
  cache.set(tid, identity);
  return identity;
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

async function handleQueueItemFailure(
  supabase: ReturnType<typeof createClient>,
  email: EmailQueueItem,
  errorMessage: string,
): Promise<void> {
  const attempts = email.attempts + 1;
  console.error(`Queue item ${email.id} failed:`, errorMessage);

  if (attempts < MAX_RETRIES) {
    await supabase
      .from("email_queue")
      .update({
        status: "pending",
        attempts,
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", email.id);
    return;
  }

  await supabase.from("email_queue").delete().eq("id", email.id);
}

async function prepareQueueItemPayload(
  email: EmailQueueItem,
  cache: Map<string, EmailTemplate>,
  supabase: ReturnType<typeof createClient>,
  mailFromName: string,
  mailSender: string,
  supabaseUrl: string,
  defaultTenantId: string | null,
  identityCache: Map<string, MailIdentity>,
): Promise<Record<string, unknown>> {
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

  const identity = await resolveQueueMailIdentity(
    supabase,
    tid,
    mailFromName,
    mailSender,
    identityCache,
  );

  return buildResendEmailObject({
    fromHeader: identity.fromHeader,
    recipient: email.recipient,
    subject,
    htmlBody,
    textBody,
    replyTo: identity.replyTo,
    listUnsubscribeHeaders: listUnsubscribeHeaders(
      mailSender,
      listUnsubscribeHttpsUrl,
    ),
  });
}

async function postResendBatch(
  payloads: Record<string, unknown>[],
  resendKey: string,
): Promise<{
  httpOk: boolean;
  status: number;
  bodyText: string;
  errors?: ResendBatchItemError[];
}> {
  const response = await fetch(`${RESEND_API}/emails/batch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
      "x-batch-validation": "permissive",
    },
    body: JSON.stringify(payloads),
  });

  const bodyText = await response.text();

  if (response.status === 429) {
    const delay = resend429DelayMs(response.headers.get("Retry-After"));
    console.log(`⏳ Rate limited. Waiting ${delay}ms before retry path`);
    await new Promise((r) => setTimeout(r, delay));
    return { httpOk: false, status: 429, bodyText };
  }

  if (!response.ok) {
    console.error(`❌ Resend batch failed: ${response.status}`, bodyText);
    return { httpOk: false, status: response.status, bodyText };
  }

  let errors: ResendBatchItemError[] | undefined;
  try {
    const json = JSON.parse(bodyText) as { errors?: ResendBatchItemError[] };
    if (Array.isArray(json.errors)) {
      errors = json.errors;
    }
  } catch {
    /* non-JSON success body */
  }

  console.log(`✅ Resend batch accepted (${payloads.length} email(s))`);
  return { httpOk: true, status: response.status, bodyText, errors };
}

async function processLockedBatch(
  supabase: ReturnType<typeof createClient>,
  queueItems: EmailQueueItem[],
  templateCache: Map<string, EmailTemplate>,
  resendKey: string,
  mailSender: string,
  mailFromName: string,
  supabasePublicUrl: string,
  defaultTenantId: string | null,
  identityCache: Map<string, MailIdentity>,
): Promise<{ sent: number; failedOrRetry: number }> {
  let sent = 0;
  let failedOrRetry = 0;

  const prepared: { email: EmailQueueItem; payload: Record<string, unknown> }[] =
    [];

  for (const row of queueItems) {
    try {
      const payload = await prepareQueueItemPayload(
        row,
        templateCache,
        supabase,
        mailFromName,
        mailSender,
        supabasePublicUrl,
        defaultTenantId,
        identityCache,
      );
      prepared.push({ email: row, payload });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await handleQueueItemFailure(supabase, row, message);
      failedOrRetry++;
    }
  }

  if (prepared.length === 0) {
    return { sent, failedOrRetry };
  }

  const batchResult = await postResendBatch(
    prepared.map((p) => p.payload),
    resendKey,
  );

  const classified = classifyResendBatchResult({
    httpOk: batchResult.httpOk,
    status: batchResult.status,
    chunkLength: prepared.length,
    errors: batchResult.errors,
    responseBody: batchResult.bodyText,
  });

  for (let i = 0; i < prepared.length; i++) {
    const { email } = prepared[i];
    if (classified.outcomes[i] === "success") {
      const { error: delErr } = await supabase
        .from("email_queue")
        .delete()
        .eq("id", email.id);
      if (delErr) {
        await handleQueueItemFailure(
          supabase,
          email,
          delErr.message ?? "Delete after send failed",
        );
        failedOrRetry++;
      } else {
        sent++;
      }
    } else {
      let message: string;
      if (batchResult.status === 429) {
        message = "Resend rate limited (429)";
      } else if (classified.requestLevelFailure) {
        message = classified.message ?? "Resend batch request failed";
      } else {
        const itemErr = batchResult.errors?.find((e) => e.index === i);
        message = itemErr?.message ?? classified.message ?? "Resend batch item failed";
      }
      await handleQueueItemFailure(supabase, email, message);
      failedOrRetry++;
    }
  }

  return { sent, failedOrRetry };
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
    const identityCache = new Map<string, MailIdentity>();
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
        .limit(RESEND_BATCH_SIZE);

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

      const batchResult = await processLockedBatch(
        supabase,
        queueItems as EmailQueueItem[],
        templateCache,
        resendKey,
        mailSender,
        mailFromName,
        supabasePublicUrl,
        defaultTenantId,
        identityCache,
      );

      totalSent += batchResult.sent;
      totalFailed += batchResult.failedOrRetry;

      if (queueItems.length < RESEND_BATCH_SIZE) break;

      await new Promise((r) => setTimeout(r, RESEND_INTER_BATCH_PAUSE_MS));
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
