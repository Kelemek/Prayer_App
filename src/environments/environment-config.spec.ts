import { describe, it, expect } from 'vitest';
import {
  normalizeCookieParentDomain,
  normalizeTenantHostSuffix,
  parsePlatformHosts,
} from './environment-config';

describe('environment-config', () => {
  it('parses platform hosts', () => {
    expect(parsePlatformHosts('a.example.com, B.Example.COM ,')).toEqual([
      'a.example.com',
      'b.example.com',
    ]);
  });

  it('normalizes cookie parent domain', () => {
    expect(normalizeCookieParentDomain('.prayer.romans8.net')).toBe('.prayer.romans8.net');
    expect(normalizeCookieParentDomain('prayer.romans8.net')).toBe('.prayer.romans8.net');
    expect(normalizeCookieParentDomain('')).toBe('');
  });

  it('normalizes tenant host suffix', () => {
    expect(normalizeTenantHostSuffix('.prayer.romans8.net')).toBe('prayer.romans8.net');
  });
});
