/**
 * Resend /emails/batch helpers for queue drain (one recipient per message).
 * Keep aligned with supabase/functions/trigger-email-processor/index.ts (inlined there).
 */

/** Resend batch endpoint: max emails per request */
export const RESEND_BATCH_SIZE = 100;

/** Pause between batch HTTP requests (matches send-email bulk) */
export const RESEND_INTER_BATCH_PAUSE_MS = 250;

/** Default wait when Resend returns 429 without Retry-After */
export const RESEND_429_DEFAULT_WAIT_MS = 5000;

export interface ResendBatchEmailInput {
  fromHeader: string;
  recipient: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  replyTo?: string;
  listUnsubscribeHeaders: Record<string, string>;
}

export interface ResendBatchEmailObject {
  from: string;
  to: string[];
  subject: string;
  headers: Record<string, string>;
  reply_to?: string;
  html?: string;
  text?: string;
}

export interface ResendBatchItemError {
  index: number;
  message: string;
}

export type BatchIndexOutcome = 'success' | 'failure';

export interface ClassifiedBatchResult {
  /** One outcome per payload index (same order as the batch request). */
  outcomes: BatchIndexOutcome[];
  /** True when the HTTP request failed (e.g. 429 after wait, 5xx) — entire chunk should retry. */
  requestLevelFailure: boolean;
  message?: string;
}

/** Build a single Resend batch item: exactly one `to` address (no BCC/multi-recipient To). */
export function buildResendEmailObject(input: ResendBatchEmailInput): ResendBatchEmailObject {
  const payload: ResendBatchEmailObject = {
    from: input.fromHeader,
    to: [input.recipient],
    subject: input.subject,
    headers: input.listUnsubscribeHeaders,
  };
  if (input.replyTo) {
    payload.reply_to = input.replyTo;
  }
  if (input.htmlBody) {
    payload.html = input.htmlBody;
    if (input.textBody) {
      payload.text = input.textBody;
    }
  } else {
    payload.text = input.textBody || '';
  }
  return payload;
}

/**
 * Map a Resend batch HTTP response to per-index outcomes.
 * Use with x-batch-validation: permissive for partial item errors on HTTP 200.
 */
export function classifyResendBatchResult(params: {
  httpOk: boolean;
  status: number;
  chunkLength: number;
  errors?: ResendBatchItemError[] | null;
  responseBody?: string;
}): ClassifiedBatchResult {
  const { httpOk, chunkLength, errors, responseBody } = params;
  const allSuccess = (): ClassifiedBatchResult => ({
    outcomes: Array.from({ length: chunkLength }, () => 'success' as const),
    requestLevelFailure: false,
  });

  if (chunkLength <= 0) {
    return { outcomes: [], requestLevelFailure: false };
  }

  if (!httpOk) {
    return {
      outcomes: Array.from({ length: chunkLength }, () => 'failure' as const),
      requestLevelFailure: true,
      message: responseBody?.trim() || `HTTP ${params.status}`,
    };
  }

  if (!errors?.length) {
    return allSuccess();
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
    outcomes.push(failed.has(i) ? 'failure' : 'success');
  }

  return {
    outcomes,
    requestLevelFailure: false,
    message: errors.map((e) => `[${e.index}] ${e.message}`).join('; '),
  };
}

/** Parse Retry-After header (seconds) for Resend 429 handling. */
export function resend429DelayMs(retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!Number.isNaN(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }
  return RESEND_429_DEFAULT_WAIT_MS;
}
