import { describe, it, expect } from 'vitest';
import {
  compareTenantUserDirectoryRows,
  mergeUsersWithTenantsAndGroups,
  tenantUserDirectoryMatchesQuery,
} from './tenant-user-directory';

describe('tenant-user-directory', () => {
  it('matches search against tenant names', () => {
    const user = {
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      tenants: [{ id: 't-1', name: 'Alpha Church' }],
      groups: [{ id: 'g-1', name: 'Youth' }],
    };
    expect(tenantUserDirectoryMatchesQuery(user, 'alpha')).toBe(true);
    expect(tenantUserDirectoryMatchesQuery(user, 'youth')).toBe(true);
    expect(tenantUserDirectoryMatchesQuery(user, 'missing')).toBe(false);
  });

  it('sorts by stacked tenant names with email as a tiebreaker', () => {
    const a = {
      email: 'a@example.com',
      name: 'A',
      tenants: [{ id: 't-1', name: 'Zeta' }],
      groups: [],
    };
    const b = {
      email: 'b@example.com',
      name: 'B',
      tenants: [{ id: 't-2', name: 'Alpha' }],
      groups: [],
    };
    expect(compareTenantUserDirectoryRows(a, b, 'tenant', 'asc')).toBeGreaterThan(0);
  });

  it('prefers tenant membership name over group membership name', () => {
    const rows = mergeUsersWithTenantsAndGroups(
      [{ user_email: 'ada@example.com', name: 'Ada Lovelace', tenants: { id: 't-1', name: 'Church' } }],
      [{ user_email: 'ada@example.com', name: 'Ada L.', prayer_groups: { id: 'g-1', name: 'Youth' } }]
    );
    expect(rows[0].name).toBe('Ada Lovelace');
  });
});
