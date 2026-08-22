import { describe, it, expect } from 'vitest';
import { AdminDeletionsPanelComponent } from './admin-deletions-panel.component';

describe('AdminDeletionsPanelComponent', () => {
  it('counts prayer and update deletion queues', () => {
    const panel = new AdminDeletionsPanelComponent();
    panel.adminData = {
      pendingDeletionRequests: [{ id: 'd1' }],
      pendingUpdateDeletionRequests: [{ id: 'u1' }, { id: 'u2' }],
    } as never;
    expect(panel.pendingPrayerDeletions).toBe(1);
    expect(panel.pendingUpdateDeletions).toBe(2);
  });
});
