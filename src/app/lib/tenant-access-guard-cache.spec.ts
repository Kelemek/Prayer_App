import { describe, expect, it, vi } from 'vitest';
import {
  readTenantAccessMemberCache,
  writeTenantAccessMemberCache,
  clearTenantAccessMemberCache,
} from './tenant-access-guard-cache';

describe('tenant-access-guard-cache', () => {
  const storage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };

  it('returns false when cache is missing', () => {
    storage.getItem.mockReturnValue(null);
    expect(readTenantAccessMemberCache('t1', 'u@x.com', storage)).toBe(false);
  });

  it('returns true for fresh member cache', () => {
    storage.getItem.mockReturnValue(
      JSON.stringify({ state: 'member', savedAt: Date.now() })
    );
    expect(readTenantAccessMemberCache('t1', 'u@x.com', storage)).toBe(true);
  });

  it('returns false when cache expired', () => {
    storage.getItem.mockReturnValue(
      JSON.stringify({ state: 'member', savedAt: Date.now() - 6 * 60 * 1000 })
    );
    expect(readTenantAccessMemberCache('t1', 'u@x.com', storage)).toBe(false);
  });

  it('writes and clears member cache', () => {
    writeTenantAccessMemberCache('t1', 'u@x.com', storage);
    expect(storage.setItem).toHaveBeenCalled();
    clearTenantAccessMemberCache('t1', 'u@x.com', storage);
    expect(storage.removeItem).toHaveBeenCalled();
  });
});
