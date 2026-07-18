import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScriptureService } from './scripture.service';
import { SupabaseService } from './supabase.service';

describe('ScriptureService', () => {
  let service: ScriptureService;
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    service = new ScriptureService({
      getSupabaseUrl: () => 'https://example.supabase.co',
      getPublishableKey: () => 'publishable-key',
      client: {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { access_token: 'user-jwt' } },
          }),
        },
      },
    } as unknown as SupabaseService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads passage text from scripture edge function', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        reference: 'John 3:16',
        text: 'For God so loved the world',
        translation: 'esv',
      }),
    });

    const passage = await service.getPassage('John 3:16', 'esv');
    expect(passage.text).toContain('For God so loved the world');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/scripture?reference=John'),
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'publishable-key',
          Authorization: 'Bearer user-jwt',
        }),
      })
    );
  });

  it('throws when scripture request fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not found' }),
    });
    await expect(service.getPassage('Bad Ref')).rejects.toThrow('Not found');
  });

  it('loads audio metadata from scripture-audio edge function', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ audioUrl: 'https://audio.example/passage.mp3', useSpeechSynthesis: false }),
    });

    const audio = await service.getAudioUrl('Psalm 23', 'esv');
    expect(audio.audioUrl).toContain('passage.mp3');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/scripture-audio'),
      expect.any(Object)
    );
  });
});
