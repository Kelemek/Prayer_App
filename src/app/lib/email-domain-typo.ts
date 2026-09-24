/** Common mistyped domains → canonical domain (lowercase keys). */
const DOMAIN_TYPOS: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
};

/** If the domain looks like a known typo, return the same local part on the corrected domain. */
export function suggestEmailDomainCorrection(email: string): string | null {
  const normalized = email.toLowerCase().trim();
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1) {
    return null;
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const fixedDomain = DOMAIN_TYPOS[domain];
  if (!fixedDomain || fixedDomain === domain) {
    return null;
  }
  return `${local}@${fixedDomain}`;
}
