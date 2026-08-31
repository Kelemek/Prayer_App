import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { MemorizationPracticeMode } from '../../types/memorization';
import type { PlatformPlanTier } from '../../types/platform-plan';
import { PlatformPlanService } from '../../services/platform-plan.service';
import { AdminCollapsibleSectionComponent } from '../admin-collapsible-section/admin-collapsible-section.component';
import { AdminSectionLoadingComponent } from '../admin-section-loading/admin-section-loading.component';

const PRACTICE_MODE_LABELS: Record<MemorizationPracticeMode, string> = {
  type: 'Type mode',
  firstLetters: 'Initials mode',
  word: 'Word mode',
  reorder: 'Reorder mode',
  recite: 'Recite mode (uses OpenAI when Whisper STT is enabled)',
};

const TIER_LABELS: Record<PlatformPlanTier, string> = {
  free: 'Free',
  pro: 'Pro',
  churches: 'Church',
};

@Component({
  selector: 'app-admin-platform-plan-settings',
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
      title="Platform plan settings"
      triggerId="platform-plan-settings-trigger"
      panelId="platform-plan-settings-panel"
      [expanded]="sectionExpanded"
      (expandedChange)="onExpandedChange($event)"
    >
      <svg
        sectionIcon
        class="text-blue-600 dark:text-blue-400 shrink-0"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="12 2 2 7 12 12 22 7 12 2"></polyline>
        <polyline points="2 17 12 22 22 17"></polyline>
        <polyline points="2 12 12 17 22 12"></polyline>
      </svg>

      @if (loading) {
        <app-admin-section-loading message="Loading platform plan settings…" />
      } @else {
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Configure group limits and memorization practice modes for each subscription tier.
        </p>

        @for (tier of tiers; track tier) {
          <section class="mb-8 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
              {{ tierLabels[tier] }}
            </h3>

            <div class="grid sm:grid-cols-2 gap-4 mb-6">
              <label class="block text-sm">
                <span class="text-gray-700 dark:text-gray-300">Max groups owned</span>
                <input
                  type="number"
                  min="0"
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2"
                  [(ngModel)]="groupLimits[tier].max_groups_owned"
                />
              </label>
              <label class="block text-sm">
                <span class="text-gray-700 dark:text-gray-300">Max members per group</span>
                <input
                  type="number"
                  min="1"
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2"
                  [(ngModel)]="groupLimits[tier].max_members_per_group"
                />
              </label>
            </div>

            <fieldset class="space-y-2 mb-4">
              <legend class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Memorization practice modes
              </legend>
              @for (mode of practiceModes; track mode) {
                <label class="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    class="mt-1"
                    [checked]="practiceModeEnabled[tier][mode]"
                    (change)="practiceModeEnabled[tier][mode] = $any($event.target).checked"
                  />
                  <span>
                    {{ practiceModeLabels[mode] }}
                    @if (mode === 'recite') {
                      <span class="ml-1 text-xs text-amber-700 dark:text-amber-300">(OpenAI cost)</span>
                    }
                  </span>
                </label>
              }
            </fieldset>

            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium cursor-pointer disabled:opacity-50"
              [disabled]="savingTier === tier"
              (click)="saveTier(tier)"
            >
              {{ savingTier === tier ? 'Saving…' : 'Save ' + tierLabels[tier] }}
            </button>
          </section>
        }

        @if (successMessage) {
          <p class="text-sm text-green-700 dark:text-green-300">{{ successMessage }}</p>
        }
        @if (errorMessage) {
          <p class="text-sm text-red-700 dark:text-red-300">{{ errorMessage }}</p>
        }
      }
    </app-admin-collapsible-section>
  `,
})
export class AdminPlatformPlanSettingsComponent {
  sectionExpanded = false;
  private sectionInitialLoadDone = false;

  readonly tiers: PlatformPlanTier[] = ['free', 'pro', 'churches'];
  readonly practiceModes: MemorizationPracticeMode[] = [
    'type',
    'firstLetters',
    'word',
    'reorder',
    'recite',
  ];
  readonly tierLabels = TIER_LABELS;
  readonly practiceModeLabels = PRACTICE_MODE_LABELS;

  loading = false;
  savingTier: PlatformPlanTier | null = null;
  successMessage = '';
  errorMessage = '';

  groupLimits: Record<
    PlatformPlanTier,
    { max_groups_owned: number; max_members_per_group: number }
  > = {
    free: { max_groups_owned: 1, max_members_per_group: 5 },
    pro: { max_groups_owned: 10, max_members_per_group: 25 },
    churches: { max_groups_owned: 25, max_members_per_group: 100 },
  };

  practiceModeEnabled: Record<PlatformPlanTier, Record<MemorizationPracticeMode, boolean>> = {
    free: {
      type: true,
      firstLetters: true,
      word: true,
      reorder: true,
      recite: false,
    },
    pro: {
      type: true,
      firstLetters: true,
      word: true,
      reorder: true,
      recite: true,
    },
    churches: {
      type: true,
      firstLetters: true,
      word: true,
      reorder: true,
      recite: true,
    },
  };

  constructor(
    private platformPlan: PlatformPlanService,
    private cdr: ChangeDetectorRef
  ) {}

  onExpandedChange(expanded: boolean): void {
    this.sectionExpanded = expanded;
    if (this.sectionExpanded && !this.sectionInitialLoadDone) {
      this.sectionInitialLoadDone = true;
      void this.load();
    }
    this.cdr.markForCheck();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    const settings = await this.platformPlan.loadSettings();
    if (!settings) {
      this.errorMessage = 'Failed to load platform plan settings.';
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    for (const row of settings.limits) {
      this.groupLimits[row.plan_tier] = {
        max_groups_owned: row.max_groups_owned,
        max_members_per_group: row.max_members_per_group,
      };
    }

    for (const tier of this.tiers) {
      for (const mode of this.practiceModes) {
        this.practiceModeEnabled[tier][mode] = false;
      }
    }
    for (const row of settings.practice_modes) {
      this.practiceModeEnabled[row.plan_tier][row.practice_mode] = row.enabled;
    }

    this.loading = false;
    this.cdr.markForCheck();
  }

  async saveTier(tier: PlatformPlanTier): Promise<void> {
    this.savingTier = tier;
    this.successMessage = '';
    this.errorMessage = '';
    this.cdr.markForCheck();

    const limits = this.groupLimits[tier];
    const limitsOk = await this.platformPlan.saveGroupLimits(
      tier,
      limits.max_groups_owned,
      limits.max_members_per_group
    );
    const modesOk = await this.platformPlan.savePracticeModes(
      tier,
      this.practiceModeEnabled[tier]
    );

    this.savingTier = null;
    if (limitsOk && modesOk) {
      this.successMessage = `${TIER_LABELS[tier]} settings saved.`;
    } else {
      this.errorMessage = `Failed to save ${TIER_LABELS[tier]} settings.`;
    }
    this.cdr.markForCheck();
  }
}
