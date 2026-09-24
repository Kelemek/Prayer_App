import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MemorizationReciteService,
  RECITE_MIN_DURATION_MS,
} from './memorization-recite.service';

const { speechStop, speechStart, speechAbort } = vi.hoisted(() => ({
  speechStop: vi.fn().mockResolvedValue('spoken words'),
  speechStart: vi.fn(),
  speechAbort: vi.fn(),
}));

vi.mock('../lib/memorization/memorizationBrowserSpeech', () => ({
  isBrowserSttSupported: vi.fn(() => true),
  BrowserSpeechSession: class MockBrowserSpeechSession {
    start = speechStart;
    stop = speechStop;
    abort = speechAbort;
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

describe('MemorizationReciteService', () => {
  let service: MemorizationReciteService;
  let now: number;

  beforeEach(() => {
    vi.clearAllMocks();
    now = 10_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    service = new MemorizationReciteService({
      client: {
        rpc: vi.fn().mockResolvedValue({ error: null }),
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { access_token: 'token' } },
          }),
        },
      },
      getSupabaseUrl: () => 'https://example.supabase.co',
      getPublishableKey: () => 'pk',
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports browser STT support', () => {
    expect(service.isBrowserSttSupported()).toBe(true);
  });

  it('records with browser STT and returns transcript', async () => {
    await service.startRecording('browser');
    now += RECITE_MIN_DURATION_MS + 100;
    const transcript = await service.stopAndTranscribe({
      sttProvider: 'browser',
      tenantId: 'tenant-1',
      memorizedItemId: 'item-1',
    });
    expect(transcript).toBe('spoken words');
    expect(speechStart).toHaveBeenCalled();
  });

  it('rejects stop when recording is too short', async () => {
    await service.startRecording('browser');
    now += 100;
    await expect(
      service.stopAndTranscribe({ sttProvider: 'browser', tenantId: 'tenant-1' })
    ).rejects.toThrow('too short');
  });

  it('cancelRecording clears in-flight state', async () => {
    await service.startRecording('browser');
    await service.cancelRecording();
    await expect(
      service.stopAndTranscribe({ sttProvider: 'browser', tenantId: 'tenant-1' })
    ).rejects.toThrow('No active recording');
  });

  it('transcribes whisper recordings via edge function', async () => {
    const stop = vi.fn();
    const tracks = [{ stop: vi.fn() }];
    vi.stubGlobal(
      'navigator',
      {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => tracks }),
        },
      } as Navigator
    );
    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      state = 'recording';
      mimeType = 'audio/webm';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
      }
      stop() {
        this.state = 'inactive';
        stop();
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', MockMediaRecorder as never);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ transcript: 'whisper text' }),
      })
    );

    await service.startRecording('whisper');
    now += RECITE_MIN_DURATION_MS + 100;
    const transcript = await service.stopAndTranscribe({
      sttProvider: 'whisper',
      tenantId: 'tenant-1',
    });
    expect(transcript).toBe('whisper text');
    expect(stop).toHaveBeenCalled();
  });
});
