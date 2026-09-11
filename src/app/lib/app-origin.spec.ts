import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { environment } from '../../environments/environment';
import {
  buildTenantInviteUrl,
  getAuthRedirectOrigin,
  getTenantOrigin,
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

  it('buildTenantInviteUrl includes join path', () => {
    expect(buildTenantInviteUrl('alpha', 'token-123')).toBe(
      'https://alpha.prayer.romans8.net/join/token-123'
    );
  });

  it('buildTenantInviteUrl falls back to platform appUrl when suffix is empty', () => {
    environment.tenantHostSuffix = '';
    expect(buildTenantInviteUrl('alpha', 'token-123')).toBe(
      'https://prayer.romans8.net/join/token-123'
    );
  });
});
