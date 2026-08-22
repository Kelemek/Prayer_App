import { describe, it, expect } from 'vitest';
import { AdminApprovalsPanelComponent } from './admin-approvals-panel.component';

describe('AdminApprovalsPanelComponent', () => {
  it('tracks prayers by id', () => {
    const panel = new AdminApprovalsPanelComponent();
    expect(panel.trackByPrayerId(0, { id: 'p1' })).toBe('p1');
  });
});
