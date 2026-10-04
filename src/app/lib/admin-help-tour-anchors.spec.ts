import { describe, it, expect } from 'vitest';
import { adminCollapsibleTourSectionId } from './admin-help-tour-anchors';

describe('adminCollapsibleTourSectionId', () => {
  it('replaces -trigger suffix with -section', () => {
    expect(adminCollapsibleTourSectionId('email-subscribers-trigger')).toBe(
      'email-subscribers-section'
    );
  });
});
