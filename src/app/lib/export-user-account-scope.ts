/** Keys that identify the exporting user. Other values here are treated as leaks. */
export const EXPORT_USER_EMAIL_KEYS = [
  'email',
  'user_email',
  'author_email',
  'recipient',
  'requested_email',
  'created_by_email',
] as const;

export const EXPORT_USER_ID_KEYS = ['auth_user_id', 'user_id'] as const;

const EMAIL_KEY_SET = new Set<string>(EXPORT_USER_EMAIL_KEYS);
const USER_ID_KEY_SET = new Set<string>(EXPORT_USER_ID_KEYS);

export interface ExportScopeUser {
  id: string;
  email: string;
}

export interface ExportScopeLeak {
  path: string;
  key: string;
  value: string;
}

function normalizeEmail(value: string): string {
  return value.toLowerCase().trim();
}

function walkForLeaks(
  value: unknown,
  user: ExportScopeUser,
  path: string,
  leaks: ExportScopeLeak[]
): void {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkForLeaks(item, user, `${path}[${index}]`, leaks);
    });
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;
  const expectedEmail = normalizeEmail(user.email);

  for (const [key, child] of Object.entries(record)) {
    const childPath = path ? `${path}.${key}` : key;

    if (typeof child === 'string' && child.trim() !== '') {
      if (EMAIL_KEY_SET.has(key) && normalizeEmail(child) !== expectedEmail) {
        leaks.push({ path: childPath, key, value: child });
      }
      if (USER_ID_KEY_SET.has(key) && child !== user.id) {
        leaks.push({ path: childPath, key, value: child });
      }
    }

    walkForLeaks(child, user, childPath, leaks);
  }
}

/** Walk an export JSON tree and report identity fields that are not the caller. */
export function findExportScopeLeaks(
  payload: unknown,
  user: ExportScopeUser
): ExportScopeLeak[] {
  const leaks: ExportScopeLeak[] = [];
  walkForLeaks(payload, user, '', leaks);
  return leaks;
}

export function isExportUserAccountPayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record['schema_version'] === 1 &&
    typeof record['account'] === 'object' &&
    record['account'] !== null &&
    typeof record['memberships'] === 'object' &&
    typeof record['preferences'] === 'object' &&
    typeof record['prayers'] === 'object'
  );
}
