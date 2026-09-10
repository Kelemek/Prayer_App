import { describe, it, expect } from 'vitest';
import {
  buildTenantNavigationUrl,
  buildTenantOrigin,
  isSubdomainNavigationEnabled,
  parseHost,
} from './tenant-host';

const config = {
  platformHosts: [
    'prayer.romans8.net',
    'www.prayer.romans8.net',
    'prayerapp-nu.vercel.app',
  ],
  tenantHostSuffix: 'prayer.romans8.net',
};

describe('parseHost', () => {
  it('recognizes platform hosts', () => {
    expect(parseHost('prayer.romans8.net', config)).toEqual({ kind: 'platform' });
    expect(parseHost('www.prayer.romans8.net', config)).toEqual({ kind: 'platform' });
    expect(parseHost('prayerapp-nu.vercel.app', config)).toEqual({ kind: 'platform' });
  });

  it('recognizes tenant slug subdomains', () => {
    expect(parseHost('cross-pointe.prayer.romans8.net', config)).toEqual({
      kind: 'tenant',
      slug: 'cross-pointe',
    });
  });

  it('strips ports', () => {
    expect(parseHost('cross-pointe.prayer.romans8.net:4200', config)).toEqual({
      kind: 'tenant',
      slug: 'cross-pointe',
    });
  });

  it('treats nested subdomains as unknown', () => {
    expect(parseHost('a.b.prayer.romans8.net', config)).toEqual({ kind: 'unknown' });
  });

  it('supports future exact-host tenant mapping', () => {
    expect(
      parseHost('church.example.com', config, { 'church.example.com': 'tenant-uuid' })
    ).toEqual({ kind: 'tenant', tenantId: 'tenant-uuid' });
  });
});

describe('buildTenantOrigin', () => {
  it('builds tenant subdomain origin', () => {
    expect(buildTenantOrigin('cross-pointe', 'prayer.romans8.net')).toBe(
      'https://cross-pointe.prayer.romans8.net'
    );
  });
});

describe('isSubdomainNavigationEnabled', () => {
  it('is enabled on platform and tenant hosts when suffix configured', () => {
    expect(
      isSubdomainNavigationEnabled('prayer.romans8.net', config, false)
    ).toBe(true);
    expect(
      isSubdomainNavigationEnabled('alpha.prayer.romans8.net', config, false)
    ).toBe(true);
  });

  it('is disabled on native and without suffix', () => {
    expect(
      isSubdomainNavigationEnabled('prayer.romans8.net', { ...config, tenantHostSuffix: '' }, false)
    ).toBe(false);
    expect(
      isSubdomainNavigationEnabled('prayer.romans8.net', config, true)
    ).toBe(false);
  });
});

describe('buildTenantNavigationUrl', () => {
  it('preserves path and query', () => {
    expect(
      buildTenantNavigationUrl('alpha', 'prayer.romans8.net', {
        pathname: '/admin',
        search: '?tab=email',
        protocol: 'https:',
      })
    ).toBe('https://alpha.prayer.romans8.net/admin?tab=email');
  });
});
