import { describe, it, expect } from 'vitest';
import { environment } from './environment.prod';
import { environment as devEnvironment } from './environment';

describe('environment.prod', () => {
  it('should be defined', () => {
    expect(environment).toBeDefined();
  });

  it('should have production set to true', () => {
    expect(environment.production).toBe(true);
  });

  it('should have supabaseUrl defined', () => {
    expect(environment.supabaseUrl).toBeDefined();
    expect(typeof environment.supabaseUrl).toBe('string');
    if (environment.supabaseUrl) {
      expect(environment.supabaseUrl).toMatch(/^https:\/\/.+\.supabase\.co$/);
    }
  });

  it('should have supabasePublishableKey defined', () => {
    expect(environment.supabasePublishableKey).toBeDefined();
    expect(typeof environment.supabasePublishableKey).toBe('string');
  });

  it('should have all required properties', () => {
    expect(environment).toHaveProperty('production');
    expect(environment).toHaveProperty('supabaseUrl');
    expect(environment).toHaveProperty('supabasePublishableKey');
  });

  it('should use different Supabase configuration from development', () => {
    // Production and development environments use separate Supabase projects
    expect(environment.supabaseUrl).not.toBe(devEnvironment.supabaseUrl);
    expect(environment.supabasePublishableKey).not.toBe(
      devEnvironment.supabasePublishableKey
    );
  });
});
