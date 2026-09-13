import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { slugAvailabilityBlocksSubmit } from './tenant-slug-availability';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('tenant-slug-availability', () => {
  it('blocks submit until the slug is available', () => {
    expect(slugAvailabilityBlocksSubmit('idle')).toBe(true);
    expect(slugAvailabilityBlocksSubmit('checking')).toBe(true);
    expect(slugAvailabilityBlocksSubmit('taken')).toBe(true);
    expect(slugAvailabilityBlocksSubmit('invalid')).toBe(true);
    expect(slugAvailabilityBlocksSubmit('available')).toBe(false);
  });

  it('is_tenant_slug_available RPC is defined in migrations', () => {
    const sql = readFileSync(
      join(repoRoot, 'supabase/migrations/20260912120000_tenant_slug_availability.sql'),
      'utf-8'
    );
    expect(sql).toContain('is_tenant_slug_available');
    expect(sql).toContain('assert_tenant_slug_allowed');
    expect(sql).toContain('security definer');
  });
});
