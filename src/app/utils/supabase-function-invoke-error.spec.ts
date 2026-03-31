import { describe, it, expect } from 'vitest';
import { describeFunctionInvokeFailure } from './supabase-function-invoke-error';

describe('describeFunctionInvokeFailure', () => {
  it('returns JWT deploy hint for HTTP 401 on FunctionsHttpError', async () => {
    const res = new Response('', { status: 401 });
    const msg = await describeFunctionInvokeFailure(
      {
        name: 'FunctionsHttpError',
        message: 'Edge Function returned a non-2xx status code',
        context: res
      },
      res
    );
    expect(msg).toContain('401');
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
      resLike as unknown as Response
    );
    expect(msg).toContain('401');
    expect(msg).toContain('--no-verify-jwt');
  });
});
