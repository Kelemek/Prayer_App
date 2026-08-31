import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { MemorizationService } from './memorization.service';

const TEST_TENANT = { id: 'tenant-1', name: 'Test', slug: 'test' };

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    reference: 'John 3:16',
    text: 'For God so loved the world',
    translation: 'esv' as const,
    dateAdded: 1,
    lastPracticedAt: null,
    practiceSessions: [],
    inProgressPractice: null,
    kind: 'verse' as const,
    ...overrides,
  };
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    user_email: 'user@test.com',
    tenant_id: TEST_TENANT.id,
    reference: 'Psalm 23:1',
    text: 'The Lord is my shepherd',
    translation: 'esv',
    kind: 'verse',
    bible_books_scope: null,
    date_added: '2026-01-01T00:00:00Z',
    last_practiced_at: null,
    practice_sessions: [],
    in_progress_practice: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('MemorizationService', () => {
  let service: MemorizationService;
  let supabase: any;
  let toast: any;
  let userSession: any;
  let tenantContext: any;
  let connectivity: any;
  let userSession$: BehaviorSubject<{ email: string } | null>;
  let activeTenant$: BehaviorSubject<typeof TEST_TENANT | null>;

  beforeEach(() => {
    localStorage.clear();
    userSession$ = new BehaviorSubject<{ email: string } | null>({
      email: 'user@test.com',
    });
    activeTenant$ = new BehaviorSubject<typeof TEST_TENANT | null>(TEST_TENANT);
    supabase = {
      isNetworkError: vi.fn(() => false),
      client: {
        from: vi.fn(),
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { email: 'auth@test.com' } },
          }),
        },
      },
    };
    toast = { success: vi.fn(), error: vi.fn() };
    userSession = {
      userSession$,
      getCurrentSession: vi.fn(() => ({ email: 'user@test.com' })),
    };
    tenantContext = {
      getActiveTenant: vi.fn(() => TEST_TENANT),
      activeTenant$,
    };
    connectivity = {
      isOnline: vi.fn(() => true),
      requireOnline: vi.fn(() => true),
    };
    service = new MemorizationService(
      supabase,
      toast,
      userSession,
      tenantContext,
      connectivity as any
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getPreferredTranslation defaults to esv', () => {
    expect(service.getPreferredTranslation()).toBe('esv');
  });

  it('getPreferredTranslation returns stored valid translation', () => {
    localStorage.setItem('prayer_app_preferred_bible_translation', 'niv');
    expect(service.getPreferredTranslation()).toBe('niv');
  });

  it('setPreferredTranslation persists to localStorage', () => {
    service.setPreferredTranslation('kjv');
    expect(service.getPreferredTranslation()).toBe('kjv');
    expect(localStorage.getItem('prayer_app_preferred_bible_translation')).toBe(
      'kjv'
    );
  });

  it('clears items when session email is cleared', async () => {
    userSession$.next(null);
    await vi.waitFor(() => {
      expect(service.items).toEqual([]);
    });
  });

  it('loadItems clears when user is missing', async () => {
    tenantContext.getActiveTenant.mockReturnValue(TEST_TENANT);
    userSession.getCurrentSession.mockReturnValue(null);
    supabase.client.auth.getUser.mockResolvedValue({ data: { user: null } });
    await service.loadItems();
    expect(service.items).toEqual([]);
  });

  it('loadItems skips fetch when offline', async () => {
    connectivity.isOnline.mockReturnValue(false);
    supabase.client.from.mockClear();
    await service.loadItems();
    expect(supabase.client.from).not.toHaveBeenCalled();
  });

  it('loadItems maps rows and shows toast on non-network error', async () => {
    const order = vi.fn().mockResolvedValue({ data: [makeRow()], error: null });
    const ilike = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ ilike }));
    const select = vi.fn(() => ({ eq }));
    supabase.client.from.mockReturnValue({ select });

    await service.loadItems();
    const items = await firstValueFrom(service.memorizedItems$);
    expect(items).toHaveLength(1);
    expect(items[0].reference).toBe('Psalm 23:1');

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    order.mockResolvedValue({ data: null, error: { message: 'db' } });
    await service.loadItems();
    expect(toast.error).toHaveBeenCalledWith('Failed to load memorization list');
    consoleError.mockRestore();
  });

  it('addVerse rejects duplicate reference+translation', async () => {
    (service as any).itemsSubject.next([makeItem()]);
    const result = await service.addVerse('John 3:16', 'esv');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('duplicate');
  });

  it('addVerse validates offline, empty, tenant, and user', async () => {
    connectivity.requireOnline.mockReturnValue(false);
    expect(await service.addVerse('John 3:16', 'esv')).toEqual({
      ok: false,
      reason: 'db_error',
    });

    connectivity.requireOnline.mockReturnValue(true);
    expect(await service.addVerse('  ', 'esv')).toEqual({
      ok: false,
      reason: 'empty_reference',
    });

    tenantContext.getActiveTenant.mockReturnValue(TEST_TENANT);
    userSession.getCurrentSession.mockReturnValue(null);
    supabase.client.auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await service.addVerse('John 3:16', 'esv')).toEqual({
      ok: false,
      reason: 'no_user',
    });
  });

  it('addVerse inserts and returns item on success', async () => {
    const row = makeRow({ id: 'new-1', reference: 'Romans 8:28' });
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    supabase.client.from.mockReturnValue({ insert });

    const result = await service.addVerse('Romans 8:28', 'esv', 'And we know…');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.reference).toBe('Romans 8:28');
      expect(service.items[0].id).toBe('new-1');
    }
  });

  it('addVerse returns db_error on insert failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } });
    supabase.client.from.mockReturnValue({
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single })) })),
    });
    expect(await service.addVerse('John 1:1', 'esv')).toEqual({
      ok: false,
      reason: 'db_error',
    });
    consoleError.mockRestore();
  });

  it('addBibleBooks handles duplicate, success, and errors', async () => {
    (service as any).itemsSubject.next([
      makeItem({ kind: 'bibleBooks', bibleBooksScope: 'ot', reference: 'Bible Books (OT)' }),
    ]);
    expect(await service.addBibleBooks('ot', 'esv')).toEqual({
      ok: false,
      reason: 'duplicate',
    });

    (service as any).itemsSubject.next([]);
    connectivity.requireOnline.mockReturnValue(false);
    expect(await service.addBibleBooks('nt', 'esv')).toEqual({
      ok: false,
      reason: 'db_error',
    });

    connectivity.requireOnline.mockReturnValue(true);
    tenantContext.getActiveTenant.mockReturnValue(TEST_TENANT);
    userSession.getCurrentSession.mockReturnValue(null);
    supabase.client.auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await service.addBibleBooks('nt', 'esv')).toEqual({
      ok: false,
      reason: 'no_user',
    });

    userSession.getCurrentSession.mockReturnValue({ email: 'user@test.com' });
    const row = makeRow({
      id: 'bb-1',
      kind: 'bibleBooks',
      bible_books_scope: 'nt',
      reference: 'Bible Books (NT)',
    });
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    supabase.client.from.mockReturnValue({
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single })) })),
    });
    const ok = await service.addBibleBooks('nt', 'esv');
    expect(ok.ok).toBe(true);

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    single.mockResolvedValue({ data: null, error: { message: 'x' } });
    expect(await service.addBibleBooks('all', 'esv')).toEqual({
      ok: false,
      reason: 'db_error',
    });
    consoleError.mockRestore();
  });

  it('removeItem deletes and updates local list', async () => {
    (service as any).itemsSubject.next([makeItem({ id: 'del-1' })]);
    connectivity.requireOnline.mockReturnValue(false);
    expect(await service.removeItem('del-1')).toBe(false);

    connectivity.requireOnline.mockReturnValue(true);
    const eq = vi.fn().mockResolvedValue({ error: null });
    supabase.client.from.mockReturnValue({ delete: vi.fn(() => ({ eq })) });
    expect(await service.removeItem('del-1')).toBe(true);
    expect(service.items).toEqual([]);

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    eq.mockResolvedValue({ error: { message: 'fail' } });
    (service as any).itemsSubject.next([makeItem({ id: 'del-2' })]);
    expect(await service.removeItem('del-2')).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Failed to remove item');
    consoleError.mockRestore();
  });

  it('updatePracticeStats updates sessions', async () => {
    (service as any).itemsSubject.next([makeItem({ id: 'p1' })]);
    connectivity.requireOnline.mockReturnValue(false);
    expect(await service.updatePracticeStats('p1', {
      wrongAttempts: 0,
      correctKeystrokes: 10,
      completed: true,
    })).toBeNull();

    connectivity.requireOnline.mockReturnValue(true);
    expect(await service.updatePracticeStats('missing', {
      wrongAttempts: 0,
      correctKeystrokes: 1,
      completed: true,
    })).toBeNull();

    const eq = vi.fn().mockResolvedValue({ error: null });
    supabase.client.from.mockReturnValue({
      update: vi.fn(() => ({ eq })),
    });
    const updated = await service.updatePracticeStats('p1', {
      wrongAttempts: 1,
      correctKeystrokes: 5,
      completed: true,
    });
    expect(updated?.practiceSessions).toHaveLength(1);
    expect(service.items[0].lastPracticedAt).toBeTruthy();

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    eq.mockResolvedValue({ error: { message: 'fail' } });
    expect(
      await service.updatePracticeStats('p1', {
        wrongAttempts: 0,
        correctKeystrokes: 1,
        completed: false,
      })
    ).toBeNull();
    consoleError.mockRestore();
  });

  it('saveInProgress and clearInProgress update local state', async () => {
    (service as any).itemsSubject.next([makeItem({ id: 'ip1' })]);
    connectivity.requireOnline.mockReturnValue(false);
    supabase.client.from.mockClear();
    await service.saveInProgress('ip1', {
      sessionSeed: 's',
      wrongAttempts: 0,
      correctKeystrokes: 0,
      phase: { kind: 'betweenRounds', completedRoundIndex: 0 },
    });
    expect(supabase.client.from).not.toHaveBeenCalled();

    connectivity.requireOnline.mockReturnValue(true);
    const eq = vi.fn().mockResolvedValue({ error: null });
    supabase.client.from.mockReturnValue({ update: vi.fn(() => ({ eq })) });
    await service.saveInProgress('ip1', {
      sessionSeed: 's',
      wrongAttempts: 1,
      correctKeystrokes: 2,
      phase: { kind: 'betweenRounds', completedRoundIndex: 0 },
    });
    expect(service.items[0].inProgressPractice?.sessionSeed).toBe('s');

    await service.clearInProgress('ip1');
    expect(service.items[0].inProgressPractice).toBeNull();

    connectivity.requireOnline.mockReturnValue(false);
    await service.clearInProgress('ip1');

    connectivity.requireOnline.mockReturnValue(true);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    eq.mockResolvedValue({ error: { message: 'fail' } });
    await service.saveInProgress('ip1', {
      sessionSeed: 's2',
      wrongAttempts: 0,
      correctKeystrokes: 0,
      phase: { kind: 'betweenRounds', completedRoundIndex: 0 },
    });
    await service.clearInProgress('ip1');
    consoleError.mockRestore();
  });

  it('getUserEmail falls back to auth.getUser', async () => {
    userSession.getCurrentSession.mockReturnValue(null);
    supabase.client.auth.getUser.mockResolvedValue({
      data: { user: { email: 'Auth@Test.com' } },
    });
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    supabase.client.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          ilike: vi.fn(() => ({ order })),
        })),
      })),
    });
    await service.loadItems();
    expect(supabase.client.auth.getUser).toHaveBeenCalled();
  });
});
