import { describe, it, expect } from 'vitest';
import { isTenantAdminRpcUnauthorized } from './tenant-admin-rpc';

describe('isTenantAdminRpcUnauthorized', () => {
  it('returns true for tenant admin RPC rejection messages', () => {
    expect(isTenantAdminRpcUnauthorized({ message: 'Not authorized for tenant' })).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isTenantAdminRpcUnauthorized({ message: 'connection failed' })).toBe(false);
    expect(isTenantAdminRpcUnauthorized(null)).toBe(false);
  });
});
