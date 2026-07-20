import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BrowserSpeechSession,
  mapBrowserSpeechError,
} from './memorizationBrowserSpeech';

function createMockRecognition() {
  let onresult: ((event: unknown) => void) | null = null;
  let onend: (() => void) | null = null;
  let onerror: ((event: { error?: string }) => void) | null = null;
  const recognition = {
    continuous: false,
    interimResults: false,
    lang: '',
    get onresult() {
      return onresult;
    },
    set onresult(handler) {
      onresult = handler;
    },
    get onend() {
      return onend;
    },
    set onend(handler) {
      onend = handler;
    },
    get onerror() {
      return onerror;
    },
    set onerror(handler) {
      onerror = handler;
    },
    start: vi.fn(),
    stop: vi.fn(() => {
      onend?.();
    }),
    abort: vi.fn(),
  };
  return {
    recognition,
    emitResult(text: string, isFinal: boolean) {
      onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          0: { isFinal, 0: { transcript: text } },
        },
      });
    },
    emitError(code: string) {
      onerror?.({ error: code });
    },
    emitEnd() {
      onend?.();
    },
  };
}

describe('mapBrowserSpeechError', () => {
  it('maps permission errors', () => {
    expect(mapBrowserSpeechError('not-allowed')).toContain('permission');
  });
});

describe('BrowserSpeechSession', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.window = originalWindow;
  });

  function installMockRecognition() {
    const mock = createMockRecognition();
    class MockRecognition {
      constructor() {
        return mock.recognition;
      }
    }
    globalThis.window = {
      SpeechRecognition: MockRecognition,
    } as unknown as Window & typeof globalThis;
    return mock;
  }

  it('returns final transcript after stop completes', async () => {
    const mock = installMockRecognition();
    const session = new BrowserSpeechSession();
    session.start();
    mock.emitResult('For God so loved', true);
    const promise = session.stop();
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('For God so loved');
  });

  it('falls back to interim transcript when stop fires before finalization', async () => {
    const mock = installMockRecognition();
    const session = new BrowserSpeechSession();
    session.start();
    mock.emitResult('And we know that', false);
    const promise = session.stop();
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('And we know that');
  });

  it('rejects with a helpful error when nothing was heard', async () => {
    const mock = installMockRecognition();
    const session = new BrowserSpeechSession();
    session.start();
    mock.emitError('no-speech');
    await expect(session.stop()).rejects.toThrow(/No speech detected/);
    await vi.runAllTimersAsync();
  });

  it('rejects an in-flight stop when aborted', async () => {
    const mock = installMockRecognition();
    mock.recognition.stop = vi.fn();
    const session = new BrowserSpeechSession();
    session.start();
    mock.emitResult('For God', true);
    const promise = session.stop();
    session.abort();
    await expect(promise).rejects.toThrow(/interrupted/);
  });

  it('does not restart recognition after a fatal error before stop', () => {
    const mock = installMockRecognition();
    const session = new BrowserSpeechSession();
    session.start();
    mock.emitError('not-allowed');
    mock.emitEnd();
    expect(mock.recognition.start).toHaveBeenCalledTimes(1);
  });
});
