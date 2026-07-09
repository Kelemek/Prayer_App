import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { MemorizationService } from './memorization.service';

const TEST_TENANT = { id: 'tenant-1', name: 'Test', slug: 'test' };

describe('MemorizationService', () => {
  let service: MemorizationService;
  let supabase: any;
  let toast: any;
  let userSession: any;
  let tenantContext: any;
  let connectivity: any;

  beforeEach(() => {
    localStorage.clear();
    supabase = {
      isNetworkError: vi.fn(() => false),
      client: {
        from: vi.fn(),
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { email: 'user@test.com' } } }),
        },
      },
    };
    toast = { success: vi.fn(), error: vi.fn() };
    userSession = {
      userSession$: new BehaviorSubject({ email: 'user@test.com' }),
      getCurrentSession: vi.fn(() => ({ email: 'user@test.com' })),
    };
    tenantContext = {
      getActiveTenant: vi.fn(() => TEST_TENANT),
      activeTenant$: new BehaviorSubject(TEST_TENANT),
    };

    connectivity = {
      isOnline: vi.fn(() => true),
      requireOnline: vi.fn(() => true),
    };
    service = new MemorizationService(supabase, toast, userSession, tenantContext, connectivity as any);
  });

  it('getPreferredTranslation defaults to esv', () => {
    expect(service.getPreferredTranslation()).toBe('esv');
  });

  it('setPreferredTranslation persists to localStorage', () => {
    service.setPreferredTranslation('kjv');
    expect(service.getPreferredTranslation()).toBe('kjv');
    expect(localStorage.getItem('prayer_app_preferred_bible_translation')).toBe('kjv');
  });

  it('addVerse rejects duplicate reference+translation', async () => {
    (service as any).itemsSubject.next([
      {
        id: 'existing',
        reference: 'John 3:16',
        text: 'verse',
        translation: 'esv',
        dateAdded: 1,
        lastPracticedAt: null,
        practiceSessions: [],
        kind: 'verse',
      },
    ]);

    const result = await service.addVerse('John 3:16', 'For God so loved', 'esv');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('duplicate');
  });

  it('loadItems maps rows to MemorizedItem', async () => {
    const row = {
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
    };

    const order = vi.fn().mockResolvedValue({ data: [row], error: null });
    const ilike = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ ilike }));
    const select = vi.fn(() => ({ eq }));
    supabase.client.from.mockReturnValue({ select });

    await service.loadItems();
    const items = await firstValueFrom(service.memorizedItems$);
    expect(items).toHaveLength(1);
    expect(items[0].reference).toBe('Psalm 23:1');
    expect(items[0].translation).toBe('esv');
  });
});
