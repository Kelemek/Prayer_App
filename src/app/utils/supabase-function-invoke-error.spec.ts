import { describe, it, expect } from 'vitest';
import { describeFunctionInvokeFailure } from './supabase-function-invoke-error';

describe('describeFunctionInvokeFailure', () => {
  it('returns generic message for nullish errors', async () => {
    expect(await describeFunctionInvokeFailure(null)).toBe('Unknown error');
  });

  it('describes FunctionsFetchError with context', async () => {
    const message = await describeFunctionInvokeFailure({
      name: 'FunctionsFetchError',
      message: 'Failed to send',
      context: new Error('Network down'),
    });
    expect(message).toContain('Network down');
    expect(message).toContain('Edge Functions');
  });

  it('describes FunctionsHttpError 401 with deploy hint', async () => {
    const response = new Response(null, { status: 401 });
    const message = await describeFunctionInvokeFailure(
      { name: 'FunctionsHttpError', message: 'Unauthorized' },
      response,
      'verify-code'
    );
    expect(message).toContain('401');
    expect(message).toContain('verify-code');
  });

  it('maps invalid verification code JSON body to friendly text', async () => {
    const response = new Response(JSON.stringify({ error: 'Invalid verification code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    const message = await describeFunctionInvokeFailure(
      { name: 'FunctionsHttpError', message: 'Bad Request' },
      response
    );
    expect(message).toBe('The code you entered is incorrect. Please check and try again.');
  });

  it('describes FunctionsRelayError with context', async () => {
    const message = await describeFunctionInvokeFailure({
      name: 'FunctionsRelayError',
      message: 'Relay failed',
      context: 'upstream timeout',
    });
    expect(message).toContain('upstream timeout');
  });

  it('returns HTTP status when JSON body has no error field', async () => {
    const response = new Response('{}', {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
    const message = await describeFunctionInvokeFailure(
      { name: 'FunctionsHttpError', message: 'Server error' },
      response
    );
    expect(message).toBe('Edge Function returned HTTP 500');
  });

  it('falls back to error message for unknown object shapes', async () => {
    expect(await describeFunctionInvokeFailure({ message: 'Custom failure' })).toBe('Custom failure');
  });

  it('includes JSON error details when present', async () => {
    const response = new Response(JSON.stringify({ error: 'Bad input', details: 'missing field' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    const message = await describeFunctionInvokeFailure(
      { name: 'FunctionsHttpError', message: 'Bad Request' },
      response
    );
    expect(message).toBe('Bad input (missing field)');
  });

  it('uses FunctionsHttpError message when response is missing', async () => {
    expect(
      await describeFunctionInvokeFailure({
        name: 'FunctionsHttpError',
        message: 'Function exploded',
      })
    ).toBe('Function exploded');
  });

  it('stringifies primitive errors', async () => {
    expect(await describeFunctionInvokeFailure('timeout')).toBe('timeout');
  });

  it('extracts string context from FunctionsFetchError', async () => {
    const message = await describeFunctionInvokeFailure({
      name: 'FunctionsFetchError',
      message: 'Failed to send',
      context: 'CORS blocked',
    });
    expect(message).toContain('CORS blocked');
  });
});
