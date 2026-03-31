import { describe, it, expect } from 'vitest';
import { environment } from './environment';

describe('environment', () => {
  it('should be defined', () => {
    expect(environment).toBeDefined();
  });

  it('should have production set to false', () => {
    expect(environment.production).toBe(false);
  });

  it('should have supabaseUrl defined', () => {
    expect(environment.supabaseUrl).toBeDefined();
    expect(typeof environment.supabaseUrl).toBe('string');
    expect(environment.supabaseUrl).toMatch(/^https:\/\/.+\.supabase\.co$/);
  });

  it('should have supabasePublishableKey defined', () => {
    expect(environment.supabasePublishableKey).toBeDefined();
    expect(typeof environment.supabasePublishableKey).toBe('string');
    expect(environment.supabasePublishableKey.length).toBeGreaterThan(0);
  });

  it('should have all required properties', () => {
    expect(environment).toHaveProperty('production');
    expect(environment).toHaveProperty('supabaseUrl');
    expect(environment).toHaveProperty('supabasePublishableKey');
  });
});
