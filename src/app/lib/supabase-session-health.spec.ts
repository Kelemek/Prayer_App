import { describe, expect, it } from 'vitest';
import {
  isDeadAuthSessionError,
  isTransientConnectionError,
} from './supabase-session-health';

describe('supabase session health', () => {
  it('treats refresh-token and 401 failures as a dead session', () => {
    expect(
      isDeadAuthSessionError({
        message: 'Invalid Refresh Token: Refresh Token Not Found',
        code: 'refresh_token_not_found',
        status: 400,
      })
    ).toBe(true);
    expect(isDeadAuthSessionError(Object.assign(new Error('Auth session missing'), { status: 401 }))).toBe(
      true
    );
  });

  it('does not treat network failures or generic errors as a dead session', () => {
    expect(isDeadAuthSessionError(new Error('Failed to fetch'))).toBe(false);
    expect(isDeadAuthSessionError(new Error('boom'))).toBe(false);
    expect(isTransientConnectionError(new Error('timeout while fetching'))).toBe(true);
  });
});
