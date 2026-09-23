import { classifyBearer, decideUserAdmin } from '../../../supabase/functions/send-email/dual-auth';

const serviceKey = 'sb_secret_test_key';
const anonKey = 'sb_publishable_test_key';

describe('classifyBearer', () => {
  it('accepts the service-role secret before any user check', () => {
    expect(classifyBearer(serviceKey, serviceKey, anonKey)).toBe('service_role');
  });

  it('treats a missing bearer, the anon key, and a publishable key as anonymous', () => {
    expect(classifyBearer('', serviceKey, anonKey)).toBe('anonymous');
    expect(classifyBearer(anonKey, serviceKey, anonKey)).toBe('anonymous');
    expect(classifyBearer('sb_publishable_browser', serviceKey, anonKey)).toBe('anonymous');
  });

  it('treats any other bearer as a user jwt candidate', () => {
    expect(classifyBearer('user.jwt.token', serviceKey, anonKey)).toBe('user');
  });
});

describe('decideUserAdmin', () => {
  it('rejects a user branch that never resolved an email', () => {
    expect(decideUserAdmin(null, true)).toEqual({ ok: false, status: 401 });
  });

  it('rejects a signed-in user who is not an admin and is not mailing only themselves', () => {
    expect(decideUserAdmin('member@church.test', false, false)).toEqual({
      ok: false,
      status: 403,
    });
  });

  it('allows a tenant admin or super admin', () => {
    expect(decideUserAdmin('admin@church.test', true, false)).toEqual({ ok: true });
  });

  it('allows a signed-in user to email only their own address', () => {
    expect(decideUserAdmin('member@church.test', false, true)).toEqual({ ok: true });
  });

  it('allows a signed-in member when tenant membership checks passed', () => {
    expect(decideUserAdmin('member@church.test', false, { memberAllowed: true })).toEqual({
      ok: true,
    });
  });
});
