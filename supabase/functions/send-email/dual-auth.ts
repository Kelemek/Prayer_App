export type BearerClass = 'service_role' | 'anonymous' | 'user';

export function classifyBearer(
  token: string,
  serviceKey: string,
  anonKey: string,
): BearerClass {
  if (serviceKey !== '' && token === serviceKey) return 'service_role';
  if (
    token === '' ||
    (anonKey !== '' && token === anonKey) ||
    token.startsWith('sb_publishable_')
  ) {
    return 'anonymous';
  }
  return 'user';
}

export function decideUserAdmin(
  userEmail: string | null,
  isAdmin: boolean,
  selfAddressed = false,
): { ok: true } | { ok: false; status: 401 | 403 } {
  if (!userEmail) return { ok: false, status: 401 };
  if (!isAdmin && !selfAddressed) return { ok: false, status: 403 };
  return { ok: true };
}
