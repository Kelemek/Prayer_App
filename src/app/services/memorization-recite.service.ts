import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import type { MemorizationReciteSttProvider } from '../types/memorization';
import { BrowserSpeechSession, isBrowserSttSupported } from '../lib/memorization/memorizationBrowserSpeech';
import { SupabaseService } from './supabase.service';

export const RECITE_MAX_DURATION_MS = 3 * 60 * 1000;
export const RECITE_MIN_DURATION_MS = 1000;

export type ReciteRecordingCallbacks = {
  onDurationMs?: (ms: number) => void;
  onMaxDurationReached?: () => void;
};

@Injectable({
  providedIn: 'root',
})
export class MemorizationReciteService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private browserSpeech: BrowserSpeechSession | null = null;
  private recordingStartedAt = 0;
  private durationTimer: ReturnType<typeof setInterval> | null = null;
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private recordingCallbacks: ReciteRecordingCallbacks | undefined;
  private recordingActive = false;
  private recordingStartToken = 0;
  private stopInFlight: Promise<string> | null = null;
  private transcribeAbort: AbortController | null = null;

  constructor(private supabase: SupabaseService) {}

  isBrowserSttSupported(): boolean {
    return isBrowserSttSupported();
  }

  async startRecording(
    sttProvider: MemorizationReciteSttProvider,
    callbacks?: ReciteRecordingCallbacks
  ): Promise<void> {
    const startToken = ++this.recordingStartToken;
    await this.cleanup();
    this.recordingStartedAt = Date.now();
    this.recordingCallbacks = callbacks;

    try {
      if (sttProvider === 'browser') {
        if (!isBrowserSttSupported()) {
          throw new Error(
            'Speech recognition is not supported in this browser. Try Chrome or Safari, or ask your admin to enable Whisper.'
          );
        }
        this.browserSpeech = new BrowserSpeechSession();
        this.browserSpeech.start();
        if (Capacitor.isNativePlatform()) {
          try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch {
            // Web Speech may still work without a separate stream; do not abort recording.
          }
        }
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (startToken !== this.recordingStartToken) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }
        this.mediaStream = stream;
        const mimeType = this.pickRecorderMimeType();
        this.audioChunks = [];
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.audioChunks.push(e.data);
        };
        recorder.start();
        this.mediaRecorder = recorder;
      }

      if (startToken !== this.recordingStartToken) {
        await this.cleanup();
        return;
      }

      this.recordingActive = true;
      this.startDurationTimer();
    } catch (err) {
      await this.cleanup();
      throw err;
    }
  }

  async stopAndTranscribe(params: {
    sttProvider: MemorizationReciteSttProvider;
    tenantId: string;
    memorizedItemId?: string;
    prompt?: string;
  }): Promise<string> {
    if (this.stopInFlight) {
      return this.stopInFlight;
    }

    this.stopInFlight = this.finishStopAndTranscribe(params).finally(() => {
      this.stopInFlight = null;
    });
    return this.stopInFlight;
  }

  async cancelRecording(): Promise<void> {
    this.recordingStartToken += 1;
    this.transcribeAbort?.abort();
    const inFlight = this.stopInFlight;
    await this.cleanup();
    if (inFlight) {
      try {
        await inFlight;
      } catch {
        // ignore errors from an in-flight stop cancelled by cleanup
      }
    }
  }

  private async finishStopAndTranscribe(params: {
    sttProvider: MemorizationReciteSttProvider;
    tenantId: string;
    memorizedItemId?: string;
    prompt?: string;
  }): Promise<string> {
    if (!this.recordingActive) {
      await this.cleanup();
      throw new Error('No active recording.');
    }
    this.recordingActive = false;

    const durationMs = Math.max(0, Date.now() - this.recordingStartedAt);
    if (durationMs < RECITE_MIN_DURATION_MS) {
      await this.cleanup();
      throw new Error('Recording is too short. Try again.');
    }
    const maxAudioSeconds = RECITE_MAX_DURATION_MS / 1000;
    const audioSeconds = Math.min(durationMs / 1000, maxAudioSeconds);

    if (params.sttProvider === 'browser') {
      let transcript = '';
      try {
        transcript = (await this.browserSpeech?.stop()) ?? '';
      } finally {
        this.browserSpeech = null;
        await this.stopMediaStream();
        this.clearTimers();
      }
      if (!transcript.trim()) {
        throw new Error('No speech detected. Try speaking clearly and recording again.');
      }
      await this.logBrowserUsage(params.tenantId, params.memorizedItemId, audioSeconds);
      return transcript.trim();
    }

    const blob = await this.stopMediaRecorder();
    await this.stopMediaStream();
    this.clearTimers();
    if (!blob || blob.size === 0) {
      throw new Error('No audio recorded. Try again.');
    }

    return this.transcribeWhisper({
      blob,
      tenantId: params.tenantId,
      memorizedItemId: params.memorizedItemId,
      prompt: params.prompt,
      audioSeconds,
    });
  }

  private async transcribeWhisper(params: {
    blob: Blob;
    tenantId: string;
    memorizedItemId?: string;
    prompt?: string;
    audioSeconds: number;
  }): Promise<string> {
    const session = await this.supabase.client.auth.getSession();
    const token = session.data.session?.access_token;
    const form = new FormData();
    form.append('audio', params.blob, this.whisperUploadFilename(params.blob));
    form.append('tenant_id', params.tenantId);
    form.append('audio_seconds', String(params.audioSeconds));
    if (params.memorizedItemId) {
      form.append('memorized_item_id', params.memorizedItemId);
    }
    if (params.prompt) {
      form.append('prompt', params.prompt);
    }

    this.transcribeAbort = new AbortController();
    const signal = this.transcribeAbort.signal;
    try {
      const response = await fetch(
        `${this.supabase.getSupabaseUrl()}/functions/v1/transcribe-audio`,
        {
          method: 'POST',
          headers: {
            apikey: this.supabase.getPublishableKey(),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: form,
          signal,
        }
      );

      const payload = (await response.json()) as { transcript?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'Transcription failed');
      }
      const transcript = payload.transcript?.trim() ?? '';
      if (!transcript) {
        throw new Error('No speech detected in the recording.');
      }
      return transcript;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Transcription cancelled.');
      }
      throw err;
    } finally {
      this.transcribeAbort = null;
    }
  }

  private async logBrowserUsage(
    tenantId: string,
    memorizedItemId: string | undefined,
    audioSeconds: number
  ): Promise<void> {
    const { error } = await this.supabase.client.rpc('log_memorization_recite_usage', {
      p_tenant_id: tenantId,
      p_memorized_item_id: memorizedItemId ?? null,
      p_stt_provider: 'browser',
      p_audio_seconds: audioSeconds,
      p_model: 'browser-speech',
    });
    if (error) {
      console.error('[MemorizationReciteService] browser usage log', error);
    }
  }

  private pickRecorderMimeType(): string | undefined {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (const type of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return undefined;
  }

  private whisperUploadFilename(blob: Blob): string {
    const type = blob.type.toLowerCase();
    if (type.includes('mp4') || type.includes('m4a')) return 'recording.m4a';
    if (type.includes('mpeg') || type.includes('mp3')) return 'recording.mp3';
    if (type.includes('wav')) return 'recording.wav';
    if (type.includes('ogg')) return 'recording.ogg';
    return 'recording.webm';
  }

  private startDurationTimer(): void {
    this.clearTimers();
    this.durationTimer = setInterval(() => {
      this.recordingCallbacks?.onDurationMs?.(Date.now() - this.recordingStartedAt);
    }, 250);
    this.maxDurationTimer = setTimeout(() => {
      this.recordingCallbacks?.onMaxDurationReached?.();
    }, RECITE_MAX_DURATION_MS);
  }

  private clearTimers(): void {
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
  }

  private stopMediaRecorder(): Promise<Blob | null> {
    const recorder = this.mediaRecorder;
    this.mediaRecorder = null;
    if (!recorder || recorder.state === 'inactive') {
      const type = this.audioChunks[0]?.type || 'audio/webm';
      return Promise.resolve(
        this.audioChunks.length ? new Blob(this.audioChunks, { type }) : null
      );
    }
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || this.audioChunks[0]?.type || 'audio/webm';
        resolve(this.audioChunks.length ? new Blob(this.audioChunks, { type }) : null);
      };
      recorder.stop();
    });
  }

  private async stopMediaStream(): Promise<void> {
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
  }

  private async cleanup(): Promise<void> {
    this.clearTimers();
    this.recordingCallbacks = undefined;
    this.recordingActive = false;
    this.transcribeAbort?.abort();
    this.transcribeAbort = null;
    if (this.browserSpeech) {
      this.browserSpeech.abort();
      this.browserSpeech = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    await this.stopMediaStream();
  }
}
