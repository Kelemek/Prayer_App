import { describe, expect, it } from 'vitest';
import {
  nextTenantAccessPhase,
  requiresAffiliationForPhase,
} from './tenant-access-flow';

describe('tenant-access-flow', () => {
  it('maps access states to phases', () => {
    expect(nextTenantAccessPhase('member', null)).toBe('loading');
    expect(nextTenantAccessPhase('blocked', null)).toBe('blocked');
    expect(nextTenantAccessPhase('pending', null)).toBe('pending_approval');
    expect(nextTenantAccessPhase('needs_name', null)).toBe('name');
    expect(nextTenantAccessPhase('none', true)).toBe('name');
    expect(nextTenantAccessPhase('none', false)).toBe('request');
    expect(nextTenantAccessPhase('none', null)).toBe('loading');
  });

  it('requires affiliation only on request phase', () => {
    expect(requiresAffiliationForPhase('request')).toBe(true);
    expect(requiresAffiliationForPhase('name')).toBe(false);
  });
});
