import { describe, expect, it, vi } from 'vitest';
import {
  clearPersonalPrayerUpdateAnsweredFlags,
  deletePersonalPrayerRow,
  deletePersonalPrayerUpdateRow,
  fetchPersonalCategoriesList,
  fetchPersonalPrayersList,
  insertPersonalPrayerRow,
  insertPersonalPrayerUpdateRow,
  markPersonalPrayerUpdateAnsweredRow,
  queryMaxDisplayOrderForCategoryId,
  rpcDeletePersonalCategory,
  rpcEnsurePersonalCategory,
  rpcIncrementPersonalPrayedFor,
  rpcRenamePersonalCategory,
  rpcReorderPersonalCategories,
  rpcReorderPersonalPrayers,
  updatePersonalPrayerRow,
  updatePersonalPrayerUpdateRow,
} from './prayer-personal-db';

function chain(resolved: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const terminal = {
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolved),
    single: vi.fn().mockResolvedValue(resolved),
    then: (resolve: (v: unknown) => void) => resolve(resolved),
  };
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnValue(terminal),
    ...terminal,
  };
  return q;
}

describe('prayer-personal-db', () => {
  it('fetchPersonalPrayersList and categories', async () => {
    const client = { from: vi.fn(() => chain({ data: [{ id: 'p1' }], error: null })) };
    const list = await fetchPersonalPrayersList(client as never, 'u@x.com', 't1');
    expect(list.data).toHaveLength(1);
    const cats = await fetchPersonalCategoriesList(client as never, 'u@x.com', 't1');
    expect(cats.data).toEqual([{ id: 'p1' }]);
  });

  it('insert/update/delete personal prayer rows', async () => {
    const client = { from: vi.fn(() => chain({ data: { id: 'p1' }, error: null })) };
    await insertPersonalPrayerRow(client as never, { id: 'p1' });
    await updatePersonalPrayerRow(client as never, 'p1', 'u@x.com', {}, 't1');
    await deletePersonalPrayerRow(client as never, 'p1', 'u@x.com', 't1');
    expect(client.from).toHaveBeenCalledWith('personal_prayers');
  });

  it('personal prayer update helpers', async () => {
    const client = { from: vi.fn(() => chain({ data: [], error: null })) };
    await clearPersonalPrayerUpdateAnsweredFlags(client as never, 'p1');
    await updatePersonalPrayerUpdateRow(client as never, 'u1', {});
    await deletePersonalPrayerUpdateRow(client as never, 'u1', 'u@x.com');
    await markPersonalPrayerUpdateAnsweredRow(client as never, 'u1');
    expect(client.from).toHaveBeenCalledWith('personal_prayer_updates');
  });

  it('insertPersonalPrayerUpdateRow handles select().single() chain', async () => {
    const insertChain = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'u1' }, error: null }),
      }),
    };
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnValue(insertChain),
      })),
    };
    const result = await insertPersonalPrayerUpdateRow(client as never, { content: 'c' });
    expect(result.data).toEqual([{ id: 'u1' }]);
  });

  it('rpc helpers delegate to client.rpc', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'cat', error: null });
    const client = { rpc, from: vi.fn(() => chain()) };
    await rpcIncrementPersonalPrayedFor(client as never, 'p1', 'u@x.com');
    await rpcEnsurePersonalCategory(client as never, 'Health', 't1');
    await rpcReorderPersonalCategories(client as never, ['c1']);
    await rpcReorderPersonalPrayers(client as never, { p_ids: ['p1'] });
    await rpcRenamePersonalCategory(client as never, 'c1', 'Work');
    await rpcDeletePersonalCategory(client as never, 'c1');
    expect(rpc).toHaveBeenCalled();
  });

  it('queryMaxDisplayOrderForCategoryId with null category and tenant', async () => {
    const client = {
      from: vi.fn(() =>
        chain({
          data: [{ display_order: 3 }],
          error: null,
        })
      ),
    };
    const { data } = await queryMaxDisplayOrderForCategoryId(
      client as never,
      'u@x.com',
      null,
      't1'
    );
    expect(data?.display_order).toBe(3);
  });
});
