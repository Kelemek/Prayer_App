import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { environment } from '../../environments/environment';
import {
  getAuthRedirectOrigin,
  getTenantOrigin,
  resolveTenantHostSuffixForPreview,
} from './app-origin';

describe('app-origin', () => {
  const original = {
    appUrl: environment.appUrl,
    platformHosts: [...environment.platformHosts],
    tenantHostSuffix: environment.tenantHostSuffix,
  };

  beforeEach(() => {
    environment.appUrl = 'https://prayer.romans8.net';
    environment.platformHosts = ['prayer.romans8.net', 'www.prayer.romans8.net'];
    environment.tenantHostSuffix = 'prayer.romans8.net';
    vi.stubGlobal('window', {
      location: {
        origin: 'https://cross-pointe.prayer.romans8.net',
        protocol: 'https:',
        hostname: 'cross-pointe.prayer.romans8.net',
      },
    });
  });

  afterEach(() => {
    environment.appUrl = original.appUrl;
    environment.platformHosts = original.platformHosts;
    environment.tenantHostSuffix = original.tenantHostSuffix;
    vi.unstubAllGlobals();
  });

  it('getTenantOrigin prefers tenant subdomain', () => {
    expect(getTenantOrigin('cross-pointe')).toBe(
      'https://cross-pointe.prayer.romans8.net'
    );
  });

  it('getAuthRedirectOrigin uses current tenant host', () => {
    expect(getAuthRedirectOrigin()).toBe('https://cross-pointe.prayer.romans8.net');
  });
  it('resolveTenantHostSuffixForPreview prefers tenantHostSuffix', () => {
    expect(resolveTenantHostSuffixForPreview()).toBe('prayer.romans8.net');
  });

  it('resolveTenantHostSuffixForPreview uses appUrl host when suffix is empty', () => {
    environment.tenantHostSuffix = '';
    expect(resolveTenantHostSuffixForPreview()).toBe('prayer.romans8.net');
  });

  it('resolveTenantHostSuffixForPreview uses the public host on loopback', () => {
    environment.tenantHostSuffix = '';
    environment.appUrl = 'http://localhost:4200';
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:4200',
        protocol: 'http:',
        hostname: 'localhost',
      },
    });
    expect(resolveTenantHostSuffixForPreview()).toBe('prayer.romans8.net');
  });
});
