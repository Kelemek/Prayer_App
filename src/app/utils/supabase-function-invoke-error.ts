/**
 * Human-readable messages for failed Supabase functions.invoke calls.
 * FunctionsFetchError only exposes a generic message; the real cause is usually in error.context.
 * FunctionsHttpError may include a JSON body (e.g. invalid verification code) on error.context Response.
 */

function coerceToResponse(candidate: unknown): Response | null {
  if (candidate instanceof Response) return candidate;
  if (
    candidate &&
    typeof candidate === 'object' &&
    typeof (candidate as Response).status === 'number' &&
    typeof (candidate as Response).clone === 'function'
  ) {
    return candidate as Response;
  }
  return null;
}

/** @param functionName Supabase Edge Function slug (e.g. from `functions.invoke('verify-code')`). */
function http401Hint(functionName?: string): string {
  const slug = functionName?.trim();
  const deploy =
    slug !== undefined && slug.length > 0
      ? `supabase functions deploy ${slug} --no-verify-jwt`
      : 'supabase functions deploy <function-name> --no-verify-jwt';
  return (
    'This often means JWT verification is enabled on that function while the call has no valid user JWT ' +
    '(e.g. admin MFA before login, or another Edge Function using the service role client). ' +
    `If this function is meant to run without a logged-in user, redeploy with: ${deploy}. ` +
    'Also confirm your app’s Supabase publishable key matches this project.'
  );
}

export async function describeFunctionInvokeFailure(
  error: unknown,
  response?: Response | null,
  functionName?: string
): Promise<string> {
  if (!error) return 'Unknown error';
  if (typeof error !== 'object' || error === null) return String(error);

  const e = error as { name?: string; message?: string; context?: unknown };

  if (e.name === 'FunctionsFetchError') {
    const hint =
      ' If this keeps happening, confirm Edge Functions are deployed to this Supabase project and nothing is blocking requests to *.supabase.co.';
    const inner = extractFunctionsFetchContext(e.context);
    return inner ? `${inner}.${hint}` : `${e.message || 'Request failed'}.${hint}`;
  }

  if (e.name === 'FunctionsRelayError') {
    const inner = extractFunctionsFetchContext(e.context);
    return inner ? `${e.message}: ${inner}` : e.message || 'Relay error invoking Edge Function';
  }

  if (e.name === 'FunctionsHttpError') {
    const res = coerceToResponse(response ?? e.context);
    if (res) {
      if (res.status === 401) {
        return `Unauthorized (401) calling Edge Function. ${http401Hint(functionName)}`;
      }
      try {
        const clone = res.clone();
        const ct = (clone.headers.get('Content-Type') ?? '').split(';')[0].trim();
        if (ct === 'application/json') {
          const body = await clone.json();
          if (body && typeof body === 'object' && typeof (body as { error?: string }).error === 'string') {
            const msg = (body as { error: string }).error;
            const details = (body as { details?: string }).details;
            if (msg === 'Invalid verification code') {
              return 'The code you entered is incorrect. Please check and try again.';
            }
            return details ? `${msg} (${details})` : msg;
          }
        }
      } catch {
        // ignore JSON parse errors
      }
      return `Edge Function returned HTTP ${res.status}`;
    }
    return e.message || 'Edge Function returned an error';
  }

  if (typeof e.message === 'string' && e.message.length > 0) {
    return e.message;
  }
  return 'Unknown error';
}

function extractFunctionsFetchContext(context: unknown): string | null {
  if (context == null) return null;
  if (context instanceof Error && context.message) return context.message;
  if (typeof context === 'object' && context !== null && 'message' in context) {
    const m = (context as { message?: string }).message;
    if (m) return String(m);
  }
  if (typeof context === 'string' && context.length > 0) return context;
  return null;
}
