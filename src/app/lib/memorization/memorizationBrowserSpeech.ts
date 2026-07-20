export type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [altIndex: number]: { transcript: string };
    };
  };
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

export function getBrowserSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isBrowserSttSupported(): boolean {
  return getBrowserSpeechRecognitionCtor() != null;
}

export function mapBrowserSpeechError(code: string | undefined): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone or speech recognition permission was denied.';
    case 'no-speech':
      return 'No speech detected. Try speaking clearly and recording again.';
    case 'audio-capture':
      return 'Could not access the microphone. Check your device settings.';
    case 'network':
      return 'Speech recognition needs a network connection in this browser.';
    case 'aborted':
      return 'Recording was interrupted. Try again.';
    default:
      return 'Speech recognition failed. Try again or ask your admin to enable Whisper.';
  }
}

const STOP_RESULT_WAIT_MS = 2000;

const FATAL_BROWSER_SPEECH_ERRORS = new Set([
  'not-allowed',
  'service-not-allowed',
  'audio-capture',
  'network',
  'aborted',
]);

export class BrowserSpeechSession {
  private recognition: BrowserSpeechRecognition | null = null;
  private finalParts: string[] = [];
  private latestInterim = '';
  private lastError: string | null = null;
  private stopped = false;
  private stopTimeout: ReturnType<typeof setTimeout> | null = null;
  private resolveStop: ((transcript: string) => void) | null = null;
  private rejectStop: ((err: Error) => void) | null = null;

  start(): void {
    const Ctor = getBrowserSpeechRecognitionCtor();
    if (!Ctor) {
      throw new Error('Speech recognition is not supported in this browser.');
    }
    this.stopped = false;
    this.finalParts = [];
    this.latestInterim = '';
    this.lastError = null;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.[0]?.transcript?.trim();
        if (!text) continue;
        if (result.isFinal) {
          this.finalParts.push(text);
          this.latestInterim = '';
        } else {
          this.latestInterim = text;
        }
      }
    };
    recognition.onerror = (event) => {
      this.lastError = event.error ?? 'unknown';
    };
    recognition.onend = () => {
      if (this.resolveStop) {
        this.completeStop();
        return;
      }
      if (
        !this.stopped &&
        this.lastError &&
        FATAL_BROWSER_SPEECH_ERRORS.has(this.lastError)
      ) {
        this.stopped = true;
        return;
      }
      if (!this.stopped) {
        try {
          recognition.start();
        } catch {
          // ignore restart failures when already stopping
        }
      }
    };
    this.recognition = recognition;
    recognition.start();
  }

  stop(): Promise<string> {
    if (!this.recognition) {
      return Promise.resolve(this.buildTranscript());
    }
    return new Promise((resolve, reject) => {
      this.stopped = true;
      this.rejectStop = reject;
      this.resolveStop = (transcript) => {
        this.rejectStop = null;
        if (transcript) {
          resolve(transcript);
          return;
        }
        if (this.lastError) {
          reject(new Error(mapBrowserSpeechError(this.lastError)));
          return;
        }
        reject(new Error(mapBrowserSpeechError('no-speech')));
      };
      this.stopTimeout = setTimeout(() => this.completeStop(), STOP_RESULT_WAIT_MS);
      try {
        this.recognition!.stop();
      } catch {
        this.completeStop();
      }
    });
  }

  abort(): void {
    this.stopped = true;
    this.clearStopWait();
    const recognition = this.recognition;
    this.recognition = null;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    }
    if (this.rejectStop) {
      const reject = this.rejectStop;
      this.resolveStop = null;
      this.rejectStop = null;
      reject(new Error(mapBrowserSpeechError('aborted')));
    }
  }

  private completeStop(): void {
    if (!this.resolveStop) return;
    this.clearStopWait();
    const recognition = this.recognition;
    this.recognition = null;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    }
    const transcript = this.buildTranscript();
    const resolve = this.resolveStop;
    this.resolveStop = null;
    this.rejectStop = null;
    resolve?.(transcript);
  }

  private clearStopWait(): void {
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
  }

  private buildTranscript(): string {
    const finals = this.finalParts.join(' ').trim();
    if (finals) return finals;
    return this.latestInterim.trim();
  }
}
