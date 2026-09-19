import { describe, it, expect, vi } from 'vitest';
import { formatPersonName } from './planning-center';
import type { PlanningCenterPerson } from './planning-center';

describe('formatPersonName', () => {
  it('uses attributes.name when present', () => {
    const person: PlanningCenterPerson = {
      id: '1',
      type: 'Person',
      attributes: { name: 'Jane Doe', first_name: 'Jane', last_name: 'Doe' },
    };
    expect(formatPersonName(person)).toBe('Jane Doe');
  });
});

describe('planning-center invoke', () => {
  it('passes tenant_id to lookup invoke', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { people: [], count: 0 },
      error: null,
    });
    const client = { functions: { invoke } } as never;
    const { lookupPersonByEmail } = await import('./planning-center');
    await lookupPersonByEmail(client, 'tenant-uuid', 'jane@example.com');
    expect(invoke).toHaveBeenCalledWith('planning-center-lookup', {
      body: { tenant_id: 'tenant-uuid', email: 'jane@example.com' },
    });
  });
});
