import { describe, it, expect } from 'vitest';
import { AdminAccountsPanelComponent } from './admin-accounts-panel.component';

describe('AdminAccountsPanelComponent', () => {
  it('tracks account requests by id', () => {
    const panel = new AdminAccountsPanelComponent();
    expect(panel.trackByAccountRequestId(0, { id: 'a1' })).toBe('a1');
  });
});
