import { describe, it, expect } from 'vitest';
import { uniquePrayerTypeNamesInOrder } from './prayer-type-names';

describe('uniquePrayerTypeNamesInOrder', () => {
  it('returns names in first-seen order', () => {
    expect(
      uniquePrayerTypeNamesInOrder([
        { name: 'Healing' },
        { name: 'Guidance' },
      ])
    ).toEqual(['Healing', 'Guidance']);
  });

  it('drops duplicate names', () => {
    expect(
      uniquePrayerTypeNamesInOrder([
        { name: 'Healing' },
        { name: 'Healing' },
        { name: 'Missions' },
        { name: ' Missions ' },
      ])
    ).toEqual(['Healing', 'Missions']);
  });
});
