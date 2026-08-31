import { describe, it, expect } from 'vitest';
import { parseInviteEmails } from './prayer-group-invite-emails';

describe('parseInviteEmails', () => {
  it('splits comma and whitespace emails and lowercases them', () => {
    expect(parseInviteEmails('A@B.com, c@d.org; e@f.net')).toEqual([
      'a@b.com',
      'c@d.org',
      'e@f.net',
    ]);
  });

  it('ignores invalid tokens', () => {
    expect(parseInviteEmails('not-an-email, ok@ok.com')).toEqual(['ok@ok.com']);
  });
});
