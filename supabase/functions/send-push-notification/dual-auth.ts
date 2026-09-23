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

export type DecideUserAdminOptions = {
  selfAddressed?: boolean;
  memberAllowed?: boolean;
};

function normalizeDecideOptions(
  options: boolean | DecideUserAdminOptions | undefined,
): DecideUserAdminOptions {
  if (typeof options === 'boolean') return { selfAddressed: options };
  return options ?? {};
}

export function decideUserAdmin(
  userEmail: string | null,
  isAdmin: boolean,
  options: boolean | DecideUserAdminOptions = {},
): { ok: true } | { ok: false; status: 401 | 403 } {
  const { selfAddressed, memberAllowed } = normalizeDecideOptions(options);
  if (!userEmail) return { ok: false, status: 401 };
  if (isAdmin || selfAddressed || memberAllowed) return { ok: true };
  return { ok: false, status: 403 };
}
