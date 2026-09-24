import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../environments/environment', () => ({
  environment: { platformHosts: [], tenantHostSuffix: 'prayerapp.test' },
}));

vi.mock('./tenant-host', () => ({
  isSubdomainNavigationEnabled: vi.fn(() => false),
  normalizeHostname: vi.fn((h: string) => h.toLowerCase()),
  buildTenantNavigationUrl: vi.fn(() => 'https://slug.prayerapp.test/'),
}));

import {
  buildTenantNavigationUrl,
  isSubdomainNavigationEnabled,
  normalizeHostname,
} from './tenant-host';
import {
  shouldNavigateToTenantSubdomain,
  switchTenantWithNavigation,
} from './tenant-navigation';

describe('tenant-navigation', () => {
  beforeEach(() => {
    vi.mocked(isSubdomainNavigationEnabled).mockReturnValue(false);
  });

  it('shouldNavigateToTenantSubdomain delegates to tenant-host', () => {
    expect(shouldNavigateToTenantSubdomain('host.example')).toBe(false);
    expect(isSubdomainNavigationEnabled).toHaveBeenCalled();
  });

  it('switchTenantWithNavigation switches in place when subdomain nav disabled', async () => {
    const switchInPlace = vi.fn().mockResolvedValue(true);
    const result = await switchTenantWithNavigation('id', 'slug', switchInPlace);
    expect(result).toBe('switched');
    expect(switchInPlace).toHaveBeenCalledWith('id');
  });

  it('switchTenantWithNavigation returns failed when in-place switch fails', async () => {
    const result = await switchTenantWithNavigation(
      'id',
      'slug',
      vi.fn().mockResolvedValue(false)
    );
    expect(result).toBe('failed');
  });

  it('shouldNavigateToTenantSubdomain passes explicit hostname', () => {
    vi.mocked(isSubdomainNavigationEnabled).mockReturnValue(true);
    expect(shouldNavigateToTenantSubdomain('tenant.prayerapp.test')).toBe(true);
    expect(isSubdomainNavigationEnabled).toHaveBeenCalledWith(
      'tenant.prayerapp.test',
      expect.objectContaining({ tenantHostSuffix: 'prayerapp.test' }),
      false
    );
  });

  it('switchTenantWithNavigation assigns subdomain URL when hosts differ', async () => {
    vi.mocked(isSubdomainNavigationEnabled).mockReturnValue(true);
    vi.mocked(normalizeHostname).mockImplementation((h) => h.toLowerCase());
    vi.mocked(buildTenantNavigationUrl).mockReturnValue(
      'https://slug.prayerapp.test/home'
    );
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: {
        hostname: 'other.prayerapp.test',
        pathname: '/home',
        search: '?q=1',
        protocol: 'https:',
        assign,
      },
      configurable: true,
    });

    const switchInPlace = vi.fn();
    const result = await switchTenantWithNavigation('id', 'slug', switchInPlace);

    expect(result).toBe('navigated');
    expect(assign).toHaveBeenCalledWith('https://slug.prayerapp.test/home');
    expect(switchInPlace).not.toHaveBeenCalled();
  });

  it('switchTenantWithNavigation switches in place when already on target host', async () => {
    vi.mocked(isSubdomainNavigationEnabled).mockReturnValue(true);
    vi.mocked(normalizeHostname).mockImplementation((h) => h.toLowerCase());
    Object.defineProperty(window, 'location', {
      value: { hostname: 'slug.prayerapp.test' },
      configurable: true,
    });
    const switchInPlace = vi.fn().mockResolvedValue(true);
    const result = await switchTenantWithNavigation('id', 'slug', switchInPlace);
    expect(result).toBe('switched');
    expect(switchInPlace).toHaveBeenCalledWith('id');
  });

  it('switchTenantWithNavigation falls back when navigation URL is missing', async () => {
    vi.mocked(isSubdomainNavigationEnabled).mockReturnValue(true);
    vi.mocked(normalizeHostname).mockImplementation((h) => h.toLowerCase());
    vi.mocked(buildTenantNavigationUrl).mockReturnValue('');
    Object.defineProperty(window, 'location', {
      value: { hostname: 'other.prayerapp.test' },
      configurable: true,
    });
    const switchInPlace = vi.fn().mockResolvedValue(true);
    const result = await switchTenantWithNavigation('id', 'slug', switchInPlace);
    expect(result).toBe('switched');
    expect(switchInPlace).toHaveBeenCalledWith('id');
  });
});
