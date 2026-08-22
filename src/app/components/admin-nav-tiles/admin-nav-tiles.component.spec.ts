import { describe, it, expect } from 'vitest';
import { AdminNavTilesComponent } from './admin-nav-tiles.component';

describe('AdminNavTilesComponent', () => {
  it('returns consolidated approval count for the prayers tile', () => {
    const tiles = new AdminNavTilesComponent();
    tiles.consolidatedApprovalsCount = 4;
    tiles.adminData = null;
    expect(tiles.countFor('prayers')).toBe(4);
    expect(tiles.countFor('settings')).toBe(0);
  });
});
