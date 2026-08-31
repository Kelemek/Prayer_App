import type { TenantUserDirectoryRow } from '../types/tenant';

export interface TenantUserDirectoryMembershipRow {
  user_email: string | null;
  name?: string | null;
  tenants?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
}

export interface TenantUserDirectoryGroupMemberRow {
  user_email: string | null;
  name?: string | null;
  prayer_groups?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
}

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').toLowerCase().trim();
}

function namedEntries(
  value: { id?: string; name?: string } | { id?: string; name?: string }[] | null | undefined
): { id: string; name: string }[] {
  if (!value) {
    return [];
  }
  const rows = Array.isArray(value) ? value : [value];
  const result: { id: string; name: string }[] = [];
  for (const row of rows) {
    if (!row?.id) {
      continue;
    }
    result.push({ id: row.id, name: (row.name ?? '').trim() });
  }
  return result;
}

function firstNonEmpty(values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

function sortByName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

function upsertNamed(
  map: Map<string, { id: string; name: string }>,
  entries: { id: string; name: string }[]
): void {
  for (const entry of entries) {
    if (!map.has(entry.id)) {
      map.set(entry.id, entry);
    }
  }
}

export function mergeUsersWithTenantsAndGroups(
  memberships: TenantUserDirectoryMembershipRow[],
  groupMembers: TenantUserDirectoryGroupMemberRow[]
): TenantUserDirectoryRow[] {
  const byEmail = new Map<
    string,
    {
      email: string;
      names: string[];
      tenants: Map<string, { id: string; name: string }>;
      groups: Map<string, { id: string; name: string }>;
    }
  >();

  const ensure = (email: string) => {
    let row = byEmail.get(email);
    if (!row) {
      row = { email, names: [], tenants: new Map(), groups: new Map() };
      byEmail.set(email, row);
    }
    return row;
  };

  for (const membership of memberships) {
    const email = normalizeEmail(membership.user_email);
    if (!email) {
      continue;
    }
    const row = ensure(email);
    const name = membership.name?.trim();
    if (name) {
      row.names.push(name);
    }
    upsertNamed(row.tenants, namedEntries(membership.tenants));
  }

  for (const member of groupMembers) {
    const email = normalizeEmail(member.user_email);
    if (!email) {
      continue;
    }
    const row = ensure(email);
    const name = member.name?.trim();
    if (name) {
      row.names.push(name);
    }
    upsertNamed(row.groups, namedEntries(member.prayer_groups));
  }

  const rows: TenantUserDirectoryRow[] = [];
  for (const row of byEmail.values()) {
    rows.push({
      email: row.email,
      name: firstNonEmpty(row.names),
      tenants: sortByName([...row.tenants.values()]),
      groups: sortByName([...row.groups.values()]),
    });
  }

  rows.sort((a, b) => {
    const nameCmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (nameCmp !== 0) {
      return nameCmp;
    }
    return a.email.localeCompare(b.email, undefined, { sensitivity: 'base' });
  });

  return rows;
}

export function tenantUserDirectoryMatchesQuery(
  user: TenantUserDirectoryRow,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  if (user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)) {
    return true;
  }
  if (user.tenants.some((tenant) => tenant.name.toLowerCase().includes(q))) {
    return true;
  }
  return user.groups.some((group) => group.name.toLowerCase().includes(q));
}

export type TenantUserDirectorySortColumn = 'name' | 'email' | 'tenant' | 'groups';

function joinedNames(rows: { name: string }[]): string {
  return rows.map((row) => row.name).join('\n').toLowerCase();
}

export function compareTenantUserDirectoryRows(
  a: TenantUserDirectoryRow,
  b: TenantUserDirectoryRow,
  sortBy: TenantUserDirectorySortColumn,
  sortDirection: 'asc' | 'desc'
): number {
  let aVal = '';
  let bVal = '';
  switch (sortBy) {
    case 'name':
      aVal = a.name;
      bVal = b.name;
      break;
    case 'email':
      aVal = a.email;
      bVal = b.email;
      break;
    case 'tenant':
      aVal = joinedNames(a.tenants);
      bVal = joinedNames(b.tenants);
      break;
    case 'groups':
      aVal = joinedNames(a.groups);
      bVal = joinedNames(b.groups);
      break;
    default: {
      const _exhaustive: never = sortBy;
      return _exhaustive;
    }
  }

  const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
  if (cmp !== 0) {
    return sortDirection === 'asc' ? cmp : -cmp;
  }
  return a.email.localeCompare(b.email, undefined, { sensitivity: 'base' });
}
