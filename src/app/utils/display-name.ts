export function deriveNameFromEmail(email: string): string {
  const emailPart = email.split('@')[0] || '';
  const derived = emailPart
    .replace(/[._-]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return derived || email;
}

/** Prefer tenant membership name, then stored value, then email-derived fallback. */
export function resolveDisplayName(
  storedName: string | null | undefined,
  email: string | null | undefined,
  memberName?: string | null
): string {
  const membershipName = (memberName || '').trim();
  if (membershipName) return membershipName;

  const trimmed = (storedName || '').trim();
  if (trimmed) return trimmed;

  const normalizedEmail = (email || '').trim();
  if (normalizedEmail) return deriveNameFromEmail(normalizedEmail);

  return '';
}

export function resolveAuthorName(
  name: string | null | undefined,
  email: string | null | undefined,
  memberName?: string | null
): string {
  return resolveDisplayName(name, email, memberName);
}

export function getUpdateAuthorDisplay(update: {
  author?: string | null;
  author_email?: string | null;
  member_name?: string | null;
}): string {
  return resolveDisplayName(update.author, update.author_email, update.member_name) || 'Unknown';
}
