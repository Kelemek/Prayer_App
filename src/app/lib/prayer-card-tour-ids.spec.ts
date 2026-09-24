import { describe, expect, it } from 'vitest';
import { getPrayerCardAddUpdateTourElementIds } from './prayer-card-tour-ids';

describe('getPrayerCardAddUpdateTourElementIds', () => {
  it('returns walkthrough ids when personal tour anchors are enabled', () => {
    expect(getPrayerCardAddUpdateTourElementIds(true, false)).toEqual({
      content: 'tour-walkthrough-update-content',
    });
  });

  it('returns prayer update ids when update anchors are enabled', () => {
    const ids = getPrayerCardAddUpdateTourElementIds(false, true);
    expect(ids?.submit).toBe('tour-prayer-update-submit');
  });

  it('returns null when no tour anchors are enabled', () => {
    expect(getPrayerCardAddUpdateTourElementIds(false, false)).toBeNull();
  });
});
