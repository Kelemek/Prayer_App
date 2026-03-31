import { describe, it, expect } from 'vitest';
import { describeFunctionInvokeFailure } from './supabase-function-invoke-error';

describe('describeFunctionInvokeFailure', () => {
  it('returns JWT deploy hint naming the invoked function on HTTP 401', async () => {
    const res = new Response('', { status: 401 });
    const msg = await describeFunctionInvokeFailure(
      {
        name: 'FunctionsHttpError',
        message: 'Edge Function returned a non-2xx status code',
        context: res
      },
      res,
      'verify-code'
    );
    expect(msg).toContain('401');
    expect(msg).toContain('verify-code');
    expect(msg).toContain('--no-verify-jwt');
  });

  it('uses duck-typed Response-like context when instanceof Response fails', async () => {
    const resLike = {
      status: 401,
      headers: new Headers({ 'Content-Type': 'text/plain' }),
      clone: () => ({
        status: 401,
        headers: new Headers({ 'Content-Type': 'text/plain' }),
        json: async () => ({}),
        text: async () => ''
      })
    };
    const msg = await describeFunctionInvokeFailure(
      {
        name: 'FunctionsHttpError',
        message: 'Edge Function returned a non-2xx status code',
        context: resLike
      },
      resLike as unknown as Response,
      'check-admin-status'
    );
    expect(msg).toContain('401');
    expect(msg).toContain('check-admin-status');
    expect(msg).toContain('--no-verify-jwt');
  });

  it('uses a placeholder deploy command when functionName is omitted on 401', async () => {
    const res = new Response('', { status: 401 });
    const msg = await describeFunctionInvokeFailure(
      {
        name: 'FunctionsHttpError',
        message: 'Edge Function returned a non-2xx status code',
        context: res
      },
      res
    );
    expect(msg).toContain('<function-name>');
  });
});
