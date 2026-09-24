import { describe, expect, it } from 'vitest';
import { suggestEmailDomainCorrection } from './email-domain-typo';

describe('suggestEmailDomainCorrection', () => {
  it('suggests gmail.com for gmai.com typo', () => {
    expect(suggestEmailDomainCorrection('user@gmai.com')).toBe('user@gmail.com');
  });

  it('returns null for correct gmail.com', () => {
    expect(suggestEmailDomainCorrection('user@gmail.com')).toBeNull();
  });

  it('returns null for invalid email shape', () => {
    expect(suggestEmailDomainCorrection('not-an-email')).toBeNull();
  });
});
