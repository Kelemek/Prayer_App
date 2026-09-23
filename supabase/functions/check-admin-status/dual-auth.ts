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
