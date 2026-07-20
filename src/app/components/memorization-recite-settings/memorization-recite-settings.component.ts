import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import type { MemorizationReciteSttProvider, MemorizationReciteWhisperModel } from '../../types/memorization';
import {
  MEMORIZATION_RECITE_WHISPER_MODEL_LABELS,
  MEMORIZATION_RECITE_WHISPER_MODEL_RATES_USD_PER_MINUTE,
  MEMORIZATION_RECITE_WHISPER_MODELS,
} from '../../types/memorization';
import { AdminCollapsibleSectionComponent } from '../admin-collapsible-section/admin-collapsible-section.component';
import { AdminSectionLoadingComponent } from '../admin-section-loading/admin-section-loading.component';
import { MemorizationReciteSettingsService } from '../../services/memorization-recite-settings.service';
import { SupabaseService } from '../../services/supabase.service';
import { TenantContextService } from '../../services/tenant-context.service';

@Component({
  selector: 'app-memorization-recite-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminCollapsibleSectionComponent,
    AdminSectionLoadingComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-collapsible-section
      title="Memorization Recite Mode"
      triggerId="memorization-recite-settings-trigger"
      panelId="memorization-recite-panel"
      [expanded]="sectionExpanded"
      (expandedChange)="onExpandedChange($event)"
    >
      <svg
        sectionIcon
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-blue-600 dark:text-blue-400 shrink-0"
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>

      @if (isLoading) {
        <app-admin-section-loading message="Loading Recite mode settings…" />
      } @else {
        @if (!activeTenantId) {
          <p
            class="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4"
          >
            Select an organization above to configure Recite mode for that tenant.
          </p>
        } @else {
          <p class="text-gray-600 dark:text-gray-400 text-sm mb-6">
            Let users record a verse from memory and get word-by-word accuracy feedback.
            Usage is tracked per organization for reporting.
          </p>

          <form (ngSubmit)="submitSettings()" (click)="$event.stopPropagation()" class="space-y-6">
            <label
              class="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg cursor-pointer"
            >
              <input
                type="checkbox"
                [checked]="reciteEnabled"
                (click)="onEnabledClick($event)"
                [disabled]="isSaving"
                class="mt-1 h-4 w-4 text-blue-600 border-gray-300 bg-white dark:bg-gray-800 rounded focus:ring-blue-500 cursor-pointer flex-shrink-0 disabled:opacity-50"
              />
              <div class="flex-1">
                <span class="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  Enable Recite mode
                </span>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Shows Recite in memorization practice for single-verse items.
                </p>
              </div>
            </label>

            @if (reciteEnabled) {
              <div
                class="p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-600 rounded-lg space-y-3"
                role="radiogroup"
                aria-label="Speech-to-text provider"
              >
                <p class="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  Speech-to-text provider
                </p>
                <label class="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="reciteSttProvider"
                    value="browser"
                    [checked]="sttProvider === 'browser'"
                    (change)="sttProvider = 'browser'"
                    [disabled]="isSaving"
                    class="mt-1 h-4 w-4 text-blue-600"
                  />
                  <span class="text-sm text-gray-800 dark:text-gray-200">
                    <span class="font-medium">Browser speech (free)</span>
                    <span class="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      Uses the device browser. Lower accuracy; varies by phone. No API cost.
                      On Chrome, audio may be processed by Google.
                    </span>
                  </span>
                </label>
                <label class="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="reciteSttProvider"
                    value="whisper"
                    [checked]="sttProvider === 'whisper'"
                    (change)="sttProvider = 'whisper'"
                    [disabled]="isSaving"
                    class="mt-1 h-4 w-4 text-blue-600"
                  />
                  <span class="text-sm text-gray-800 dark:text-gray-200">
                    <span class="font-medium">OpenAI transcription (server)</span>
                    <span class="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      Higher accuracy than browser speech. Requires OPENAI_API_KEY on the server.
                    </span>
                  </span>
                </label>

                <div
                  class="ml-7 space-y-2 pt-1"
                  role="radiogroup"
                  aria-label="OpenAI transcription model"
                >
                  @for (model of whisperModels; track model) {
                    <label class="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="reciteWhisperModel"
                        [value]="model"
                        [checked]="whisperModel === model"
                        (change)="whisperModel = model"
                        [disabled]="isSaving || sttProvider !== 'whisper'"
                        class="mt-1 h-4 w-4 text-blue-600"
                      />
                      <span class="text-sm text-gray-800 dark:text-gray-200">
                        <span class="font-medium">{{ whisperModelLabels[model] }}</span>
                        <span class="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {{ formatWhisperRate(model) }}/min
                          @if (model === 'whisper-1') {
                            — recommended for scripture accuracy
                          }
                        </span>
                      </span>
                    </label>
                  }
                </div>
              </div>
            }

            <div class="flex gap-3 pt-2 justify-end">
              <button
                type="submit"
                [disabled]="isSaving"
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 cursor-pointer"
              >
                {{ isSaving ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </form>

          <div class="mt-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg space-y-2">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
                This month (this organization)
              </h3>
              <button
                type="button"
                (click)="refreshUsage()"
                [disabled]="usageLoading"
                class="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
            @if (usageLoading) {
              <p class="text-sm text-gray-500">Loading usage…</p>
            } @else if (usageSummary) {
              <p class="text-sm text-gray-700 dark:text-gray-300">
                {{ usageSummary.attemptCount }} attempts
                ({{ usageSummary.whisperAttemptCount }} Whisper ·
                {{ usageSummary.browserAttemptCount }} browser)
              </p>
              <p class="text-sm text-gray-700 dark:text-gray-300">
                {{ formatMinutes(usageSummary.billableAudioSeconds) }} Whisper ·
                {{ formatCost(usageSummary.estimatedCostUsd) }} billable (est.)
              </p>
            }

            <p class="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
              Pricing reference: whisper-1 $0.006/min · gpt-4o-mini-transcribe $0.003/min
            </p>

            @if (openAiUsage?.configured) {
              <p class="text-sm text-gray-700 dark:text-gray-300">
                OpenAI account (all organizations, last {{ openAiUsage.periodDays }} days):
                {{ formatCost(openAiUsage.totalUsd ?? 0) }}
                @if (openAiUsage.audioTranscriptionUsd != null) {
                  (audio: {{ formatCost(openAiUsage.audioTranscriptionUsd) }})
                }
              </p>
            } @else if (openAiUsage && !openAiUsage.configured) {
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Set OPENAI_ADMIN_KEY on the server to show organization-wide OpenAI spend here.
              </p>
            }

            <a
              href="https://platform.openai.com/usage"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open OpenAI usage dashboard →
            </a>
          </div>

          @if (successMessage) {
            <p class="text-sm text-green-700 dark:text-green-300 mt-3">{{ successMessage }}</p>
          }
          @if (errorMessage) {
            <p class="text-sm text-red-700 dark:text-red-300 mt-3">{{ errorMessage }}</p>
          }
        }
      }
    </app-admin-collapsible-section>
  `,
})
export class MemorizationReciteSettingsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  sectionExpanded = false;
  private sectionInitialLoadDone = false;
  private dataLoadedForTenantId: string | null = null;
  isLoading = false;
  usageLoading = false;
  isSaving = false;

  reciteEnabled = false;
  sttProvider: MemorizationReciteSttProvider = 'browser';
  whisperModel: MemorizationReciteWhisperModel = 'whisper-1';
  readonly whisperModels = MEMORIZATION_RECITE_WHISPER_MODELS;
  readonly whisperModelLabels = MEMORIZATION_RECITE_WHISPER_MODEL_LABELS;
  successMessage = '';
  errorMessage = '';

  usageSummary: {
    attemptCount: number;
    whisperAttemptCount: number;
    browserAttemptCount: number;
    billableAudioSeconds: number;
    estimatedCostUsd: number;
  } | null = null;

  openAiUsage: {
    configured: boolean;
    periodDays?: number;
    totalUsd?: number;
    audioTranscriptionUsd?: number;
  } | null = null;

  constructor(
    private supabase: SupabaseService,
    private reciteSettings: MemorizationReciteSettingsService,
    private tenantContext: TenantContextService,
    private cdr: ChangeDetectorRef
  ) {}

  get activeTenantId(): string | null {
    return this.tenantContext.getActiveTenant()?.id ?? null;
  }

  ngOnInit(): void {
    this.tenantContext.activeTenant$
      .pipe(
        distinctUntilChanged((a, b) => a?.id === b?.id),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        const tenantId = this.activeTenantId;
        if (!tenantId) {
          this.resetForm();
          this.dataLoadedForTenantId = null;
        } else if (tenantId !== this.dataLoadedForTenantId) {
          if (!this.sectionExpanded) {
            this.resetForm();
          }
          if (this.sectionExpanded) {
            void this.loadSettings();
          }
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onExpandedChange(expanded: boolean): void {
    this.sectionExpanded = expanded;
    const tenantId = this.activeTenantId;
    if (this.sectionExpanded && tenantId) {
      const shouldLoad =
        !this.sectionInitialLoadDone || this.dataLoadedForTenantId !== tenantId;
      if (shouldLoad) {
        this.sectionInitialLoadDone = true;
        void this.loadSettings();
      }
    }
    this.cdr.markForCheck();
  }

  onEnabledClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isSaving) return;
    this.reciteEnabled = !this.reciteEnabled;
    this.successMessage = '';
    this.cdr.markForCheck();
  }

  formatMinutes(seconds: number): string {
    const min = seconds / 60;
    return `${min < 10 ? min.toFixed(1) : Math.round(min)} min`;
  }

  formatCost(usd: number): string {
    return `$${usd.toFixed(2)}`;
  }

  formatWhisperRate(model: MemorizationReciteWhisperModel): string {
    return `$${MEMORIZATION_RECITE_WHISPER_MODEL_RATES_USD_PER_MINUTE[model].toFixed(3)}`;
  }

  async refreshUsage(): Promise<void> {
    const tenantId = this.activeTenantId;
    const email = await this.getCallerEmail();
    if (!tenantId || !email) return;
    this.usageLoading = true;
    this.cdr.markForCheck();
    try {
      this.usageSummary = await this.reciteSettings.fetchUsageSummaryForAdmin(tenantId, email);
      this.openAiUsage = await this.reciteSettings.fetchOpenAiOrgUsage(email, tenantId);
    } finally {
      this.usageLoading = false;
      this.cdr.markForCheck();
    }
  }

  async submitSettings(): Promise<void> {
    const tenantId = this.activeTenantId;
    if (!tenantId) {
      this.errorMessage = 'No active organization selected.';
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.markForCheck();
    try {
      const email = await this.getCallerEmail();
      if (!email) throw new Error('Not authenticated');
      const { error } = await this.supabase.client.rpc(
        'update_tenant_memorization_recite_settings',
        {
          p_tenant_id: tenantId,
          p_memorization_recite_enabled: this.reciteEnabled,
          p_memorization_recite_stt_provider: this.sttProvider,
          p_memorization_recite_whisper_model: this.whisperModel,
          p_email: email,
        }
      );
      if (error) throw error;
      this.reciteSettings.invalidateCache();
      this.successMessage = 'Recite mode settings saved.';
      await this.refreshUsage();
    } catch (err) {
      console.error('[MemorizationReciteSettings]', err);
      this.errorMessage = 'Failed to save settings.';
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  private async getCallerEmail(): Promise<string | null> {
    const {
      data: { session },
    } = await this.supabase.client.auth.getSession();
    return session?.user?.email?.toLowerCase().trim() || null;
  }

  private resetForm(): void {
    this.reciteEnabled = false;
    this.sttProvider = 'browser';
    this.whisperModel = 'whisper-1';
    this.usageSummary = null;
    this.openAiUsage = null;
    this.successMessage = '';
    this.errorMessage = '';
  }

  private async loadSettings(): Promise<void> {
    const tenantId = this.activeTenantId;
    if (!tenantId) return;
    this.isLoading = true;
    this.cdr.markForCheck();
    try {
      const email = await this.getCallerEmail();
      if (!email) throw new Error('Not authenticated');
      const { data: rows, error } = await this.supabase.client.rpc(
        'get_tenant_memorization_recite_settings',
        { p_tenant_id: tenantId, p_email: email }
      );
      if (error) throw error;
      const row = (rows as {
        memorization_recite_enabled?: boolean;
        memorization_recite_stt_provider?: string;
        memorization_recite_whisper_model?: string;
      }[] | null)?.[0];
      this.reciteEnabled = !!row?.memorization_recite_enabled;
      this.sttProvider =
        row?.memorization_recite_stt_provider === 'whisper' ? 'whisper' : 'browser';
      this.whisperModel =
        row?.memorization_recite_whisper_model === 'gpt-4o-mini-transcribe'
          ? 'gpt-4o-mini-transcribe'
          : 'whisper-1';
      this.errorMessage = '';
      this.dataLoadedForTenantId = tenantId;
      await this.refreshUsage();
    } catch (err) {
      console.error('[MemorizationReciteSettings] load', err);
      this.errorMessage = 'Failed to load settings.';
      this.dataLoadedForTenantId = null;
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }
}
