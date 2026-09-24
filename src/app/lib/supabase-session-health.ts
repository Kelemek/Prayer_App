const DEAD_AUTH_SESSION_RE =
  /refresh token|invalid jwt|jwt expired|bad_jwt|session_not_found|refresh_token|auth session missing|session (is )?missing|session (has )?expired|session not found/i;

const TRANSIENT_CONNECTION_RE =
  /failed to fetch|network|timeout|aborted|connection|load failed/i;

function errorText(error: unknown): { message: string; code: string; status: number } {
  if (typeof error === 'object' && error !== null) {
    const record = error as { message?: unknown; code?: unknown; status?: unknown };
    const message =
      error instanceof Error
        ? error.message
        : typeof record.message === 'string'
          ? record.message
          : String(error);
    const code =
      typeof record.code === 'string' || typeof record.code === 'number'
        ? String(record.code)
        : '';
    const status = typeof record.status === 'number' ? record.status : Number.NaN;
    return { message, code, status };
  }
  return { message: String(error ?? ''), code: '', status: Number.NaN };
}

/** Network and timeout failures leave the existing client in place. */
export function isTransientConnectionError(error: unknown): boolean {
  const { message } = errorText(error);
  return TRANSIENT_CONNECTION_RE.test(message);
}

/**
 * True only when auth itself reports the stored session is unusable.
 * A missing session with no error is signed-out, not dead.
 */
export function isDeadAuthSessionError(error: unknown): boolean {
  if (!error || isTransientConnectionError(error)) {
    return false;
  }
  const { message, code, status } = errorText(error);
  if (DEAD_AUTH_SESSION_RE.test(message) || DEAD_AUTH_SESSION_RE.test(code)) {
    return true;
  }
  return status === 401 || status === 403;
}
