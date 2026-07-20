import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, takeUntil } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import type {
  MemorizationReciteSettings,
  MemorizationReciteSttProvider,
  MemorizationReciteUsageSummary,
  MemorizationReciteWhisperModel,
} from '../types/memorization';
import {
  isMemorizationReciteSttProvider,
  isMemorizationReciteWhisperModel,
} from '../types/memorization';
import { SupabaseService } from './supabase.service';
import { TenantContextService } from './tenant-context.service';

const CACHE_KEY_BASE = 'memorization_recite_settings';
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CachedReciteSettings extends MemorizationReciteSettings {
  timestamp: number;
}

const DEFAULT_SETTINGS: MemorizationReciteSettings = {
  enabled: false,
  sttProvider: 'browser',
  whisperModel: 'whisper-1',
};

@Injectable({
  providedIn: 'root',
})
export class MemorizationReciteSettingsService implements OnDestroy {
  private settingsSubject = new BehaviorSubject<MemorizationReciteSettings>(DEFAULT_SETTINGS);
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private loadGeneration = 0;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private supabase: SupabaseService,
    private tenantContext: TenantContextService
  ) {
    this.seedFromLocalStorage();
    this.tenantContext.activeTenant$
      .pipe(
        map((t) => t?.id ?? null),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadGeneration += 1;
        this.loaded = false;
        this.loadPromise = null;
        this.settingsSubject.next(DEFAULT_SETTINGS);
        this.seedFromLocalStorage();
        this.ensureLoaded();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getSettings$(): Observable<MemorizationReciteSettings> {
    this.ensureLoaded();
    return this.settingsSubject.asObservable();
  }

  async getSettingsForActiveTenant(): Promise<MemorizationReciteSettings> {
    const generation = this.loadGeneration;
    const ok = await this.loadFromSupabase(generation);
    if (ok && generation === this.loadGeneration) {
      this.loaded = true;
    }
    return this.settingsSubject.value;
  }

  invalidateCache(): void {
    try {
      localStorage.removeItem(this.cacheKey());
    } catch {
      // ignore
    }
    this.loadGeneration += 1;
    this.loaded = false;
    this.loadPromise = null;
    this.ensureLoaded();
  }

  async fetchUsageSummaryForAdmin(
    tenantId: string,
    email: string
  ): Promise<MemorizationReciteUsageSummary | null> {
    const { data, error } = await this.supabase.client.rpc(
      'get_tenant_memorization_recite_usage_summary',
      {
        p_tenant_id: tenantId,
        p_email: email,
      }
    );
    if (error) {
      console.error('[MemorizationReciteSettingsService] usage summary', error);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return {
        attemptCount: 0,
        whisperAttemptCount: 0,
        browserAttemptCount: 0,
        totalAudioSeconds: 0,
        billableAudioSeconds: 0,
        estimatedCostUsd: 0,
      };
    }
    return {
      attemptCount: Number(row.attempt_count ?? 0),
      whisperAttemptCount: Number(row.whisper_attempt_count ?? 0),
      browserAttemptCount: Number(row.browser_attempt_count ?? 0),
      totalAudioSeconds: Number(row.total_audio_seconds ?? 0),
      billableAudioSeconds: Number(row.billable_audio_seconds ?? 0),
      estimatedCostUsd: Number(row.estimated_cost_usd ?? 0),
    };
  }

  async fetchOpenAiOrgUsage(email: string, tenantId: string): Promise<{
    configured: boolean;
    periodDays?: number;
    totalUsd?: number;
    audioTranscriptionUsd?: number;
    error?: string;
  }> {
    const url = new URL(`${this.supabase.getSupabaseUrl()}/functions/v1/get-openai-org-usage`);
    url.searchParams.set('tenant_id', tenantId);
    const session = await this.supabase.client.auth.getSession();
    const token = session.data.session?.access_token;
    const response = await fetch(url.toString(), {
      headers: {
        apikey: this.supabase.getPublishableKey(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const payload = (await response.json()) as {
      configured?: boolean;
      period_days?: number;
      total_usd?: number;
      audio_transcription_usd?: number;
      error?: string;
    };
    if (!response.ok) {
      return { configured: false, error: payload.error ?? 'Could not load OpenAI usage' };
    }
    return {
      configured: !!payload.configured,
      periodDays: payload.period_days,
      totalUsd: payload.total_usd,
      audioTranscriptionUsd: payload.audio_transcription_usd,
    };
  }

  private cacheKey(): string {
    const tid = this.tenantContext.getActiveTenant()?.id;
    return tid ? `${CACHE_KEY_BASE}:${tid}` : CACHE_KEY_BASE;
  }

  private seedFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(this.cacheKey());
      if (!raw) return;
      const cached = JSON.parse(raw) as CachedReciteSettings;
      if (Date.now() - cached.timestamp > CACHE_TTL_MS) return;
      this.settingsSubject.next({
        enabled: !!cached.enabled,
        sttProvider: isMemorizationReciteSttProvider(cached.sttProvider)
          ? cached.sttProvider
          : 'browser',
        whisperModel: isMemorizationReciteWhisperModel(cached.whisperModel)
          ? cached.whisperModel
          : 'whisper-1',
      });
    } catch {
      // ignore
    }
  }

  private writeCache(settings: MemorizationReciteSettings): void {
    try {
      const payload: CachedReciteSettings = { ...settings, timestamp: Date.now() };
      localStorage.setItem(this.cacheKey(), JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    if (!this.loadPromise) {
      const generation = this.loadGeneration;
      this.loadPromise = this.loadFromSupabase(generation)
        .then((ok) => {
          if (ok && generation === this.loadGeneration) {
            this.loaded = true;
          }
        })
        .finally(() => {
          this.loadPromise = null;
        });
    }
  }

  private async loadFromSupabase(generation: number): Promise<boolean> {
    const tenantId = this.tenantContext.getActiveTenant()?.id;
    if (!tenantId) {
      if (generation === this.loadGeneration) {
        this.settingsSubject.next(DEFAULT_SETTINGS);
      }
      return true;
    }
    const { data, error } = await this.supabase.client.rpc(
      'get_public_tenant_memorization_recite_settings',
      { p_tenant_id: tenantId }
    );
    if (generation !== this.loadGeneration) {
      return true;
    }
    if (error) {
      console.error('[MemorizationReciteSettingsService] load', error);
      return false;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const settings: MemorizationReciteSettings = {
      enabled: !!row?.memorization_recite_enabled,
      sttProvider: isMemorizationReciteSttProvider(row?.memorization_recite_stt_provider)
        ? row.memorization_recite_stt_provider
        : 'browser',
      whisperModel: isMemorizationReciteWhisperModel(row?.memorization_recite_whisper_model)
        ? row.memorization_recite_whisper_model
        : 'whisper-1',
    };
    this.settingsSubject.next(settings);
    this.writeCache(settings);
    return true;
  }
}

export type { MemorizationReciteSttProvider, MemorizationReciteWhisperModel };
