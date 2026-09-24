import { describe, it, expect, vi } from 'vitest';
import { PrayerUpdateActionsComponent } from './prayer-update-actions.component';

describe('PrayerUpdateActionsComponent', () => {
  it('builds personal edit and optional delete overflow items', () => {
    const component = new PrayerUpdateActionsComponent();
    component.update = { id: 'u1', text: 'Update', created_at: '2025-01-01' } as never;
    component.mode = 'personal';
    component.showDelete = true;

    const edit = vi.fn();
    const del = vi.fn();
    component.edit.subscribe(edit);
    component.delete.subscribe(del);

    const items = component.overflowItems;
    expect(items).toHaveLength(2);
    items[0]?.onSelect?.();
    items[1]?.onSelect?.();
    expect(edit).toHaveBeenCalled();
    expect(del).toHaveBeenCalled();
    expect(component.hostClasses).toContain('inline-flex');
  });

  it('omits edit in readonly mode', () => {
    const component = new PrayerUpdateActionsComponent();
    component.update = { id: 'u1', text: 'Update', created_at: '2025-01-01' } as never;
    component.mode = 'readonly';
    component.showDelete = true;
    expect(component.overflowItems).toHaveLength(1);
    expect(component.overflowItems[0]?.id).toBe('delete');
  });
});
