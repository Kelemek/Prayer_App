/** Parse a comma-separated host list from env (lowercase, no ports). */
export function parsePlatformHosts(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
}

/** Normalize cookie parent domain (leading dot optional). */
export function normalizeCookieParentDomain(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

/** Normalize tenant host suffix (no leading dot, lowercase). */
export function normalizeTenantHostSuffix(raw: string | undefined): string {
  return (raw?.trim() ?? '').toLowerCase().replace(/^\./, '');
}
