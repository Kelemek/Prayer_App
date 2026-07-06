import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";
import { SupabaseService } from "../../services/supabase.service";
import { PrayerEncouragementService } from "../../services/prayer-encouragement.service";
import { TenantContextService } from "../../services/tenant-context.service";
import { AdminSectionLoadingComponent } from "../admin-section-loading/admin-section-loading.component";
import { AdminCollapsibleSectionComponent } from "../admin-collapsible-section/admin-collapsible-section.component";

@Component({
  selector: "app-prayer-encouragement-settings",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminSectionLoadingComponent,
    AdminCollapsibleSectionComponent,
  ],
  template: `
    <app-admin-collapsible-section
      title="Prayer Encouragement"
      triggerId="prayer-encouragement-settings-trigger"
      panelId="prayer-encouragement-panel"
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
        <path
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        ></path>
      </svg>

      @if (isLoading) {
        <app-admin-section-loading
          message="Loading prayer encouragement settings…"
        />
      } @else {
        @if (!activeTenantId) {
          <p
            class="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4"
          >
            Select an organization above to configure prayer encouragement for
            that tenant.
          </p>
        } @else {
          <p class="text-gray-600 dark:text-gray-400 text-sm mb-6">
            Allow users to click Pray For on prayers. Choose who can see how many
            times a prayer was prayed for.
          </p>

          <form
            (ngSubmit)="submitSettings()"
            (click)="$event.stopPropagation()"
            class="space-y-6"
          >
            <label
              class="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg cursor-pointer"
            >
              <input
                type="checkbox"
                id="enablePrayerEncouragement"
                [checked]="prayerEncouragementEnabled"
                (click)="onPrayerEncouragementClick($event)"
                name="enablePrayerEncouragement"
                [disabled]="isSaving"
                aria-label="Enable Prayer Encouragement"
                class="mt-1 h-4 w-4 text-blue-600 border-gray-300 bg-white dark:bg-gray-800 rounded focus:ring-blue-500 cursor-pointer flex-shrink-0 disabled:opacity-50"
              />
              <div class="flex-1">
                <span
                  class="font-medium text-gray-900 dark:text-gray-100 text-sm"
                >
                  Enable Prayer Encouragement
                </span>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Show a "Pray For" button on prayer cards. Users can click once
                  per {{ cooldownHours }}
                  {{ cooldownHours === 1 ? "hour" : "hours" }} per prayer.
                </p>
              </div>
            </label>

            @if (prayerEncouragementEnabled) {
              <div
                class="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-600 rounded-lg"
              >
                <div class="flex-1">
                  <label
                    for="cooldownHours"
                    class="font-medium text-gray-900 dark:text-gray-100 text-sm block mb-1"
                  >
                    Cooldown (hours)
                  </label>
                  <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    How long before a user can click Pray For again on the same
                    prayer (1–168 hours).
                  </p>
                  <input
                    type="number"
                    id="cooldownHours"
                    [(ngModel)]="cooldownHours"
                    name="cooldownHours"
                    min="1"
                    max="168"
                    [disabled]="isSaving"
                    class="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div
                class="p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-600 rounded-lg space-y-3"
                role="radiogroup"
                aria-labelledby="countVisibilityHeading"
              >
                <p
                  id="countVisibilityHeading"
                  class="font-medium text-gray-900 dark:text-gray-100 text-sm block mb-1"
                >
                  Prayed-for count visibility
                </p>
                <label class="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="countVisibility"
                    [checked]="!countVisibleToAll"
                    (change)="countVisibleToAll = false"
                    [disabled]="isSaving"
                    class="mt-1 h-4 w-4 text-blue-600 border-gray-300 bg-white dark:bg-gray-800 focus:ring-blue-500 cursor-pointer flex-shrink-0 disabled:opacity-50"
                  />
                  <span class="text-sm text-gray-800 dark:text-gray-200">
                    <span class="font-medium">Requester only</span>
                    <span class="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      Only the person who submitted the prayer and admins see the
                      prayed-for count.
                    </span>
                  </span>
                </label>
                <label class="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="countVisibility"
                    [checked]="countVisibleToAll"
                    (change)="countVisibleToAll = true"
                    [disabled]="isSaving"
                    class="mt-1 h-4 w-4 text-blue-600 border-gray-300 bg-white dark:bg-gray-800 focus:ring-blue-500 cursor-pointer flex-shrink-0 disabled:opacity-50"
                  />
                  <span class="text-sm text-gray-800 dark:text-gray-200">
                    <span class="font-medium">All users</span>
                    <span class="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      Everyone can see how many people have prayed for each request.
                    </span>
                  </span>
                </label>
              </div>
            }

            <div
              class="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 justify-end"
            >
              <button
                type="submit"
                [disabled]="isSaving"
                class="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                @if (isSaving) {
                  <svg
                    class="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Saving...</span>
                } @else {
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
                    ></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  <span>Save Settings</span>
                }
              </button>
            </div>
          </form>

          @if (successMessage) {
            <div
              class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 mt-4"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
            >
              <div class="flex items-start gap-2">
                <svg
                  class="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <p class="text-sm text-green-800 dark:text-green-200">
                  {{ successMessage }}
                </p>
              </div>
            </div>
          }
          @if (errorMessage) {
            <div
              class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 mt-4"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
            >
              <div class="flex items-start gap-2">
                <svg
                  class="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                  ></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <p class="text-sm text-red-800 dark:text-red-200">
                  {{ errorMessage }}
                </p>
              </div>
            </div>
          }
        }
      }
    </app-admin-collapsible-section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [],
})
export class PrayerEncouragementSettingsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  sectionExpanded = false;
  private sectionInitialLoadDone = false;
  isLoading = false;

  get activeTenantId(): string | null {
    return this.tenantContext.getActiveTenant()?.id ?? null;
  }

  prayerEncouragementEnabled = false;
  cooldownHours = 4;
  countVisibleToAll = false;
  isSaving = false;
  successMessage = "";
  errorMessage = "";

  constructor(
    private supabase: SupabaseService,
    private prayerEncouragementService: PrayerEncouragementService,
    private tenantContext: TenantContextService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.tenantContext.activeTenant$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.activeTenantId) {
          this.resetFormState();
        } else if (this.sectionExpanded) {
          void this.loadSettings();
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
    if (this.sectionExpanded && !this.sectionInitialLoadDone) {
      this.sectionInitialLoadDone = true;
      void this.loadSettings();
    }
    this.cdr.markForCheck();
  }

  onPrayerEncouragementClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isSaving) {
      return;
    }
    this.prayerEncouragementEnabled = !this.prayerEncouragementEnabled;
    this.successMessage = '';
    this.cdr.markForCheck();
  }

  private async getCallerEmail(): Promise<string | null> {
    const { data: { session } } = await this.supabase.client.auth.getSession();
    return session?.user?.email?.toLowerCase().trim() || null;
  }

  private resetFormState(): void {
    this.prayerEncouragementEnabled = false;
    this.cooldownHours = 4;
    this.countVisibleToAll = false;
    this.successMessage = "";
    this.errorMessage = "";
  }

  async loadSettings(options?: { silent?: boolean }): Promise<void> {
    const tenantId = this.activeTenantId;
    if (!tenantId) {
      return;
    }

    if (!options?.silent) {
      this.isLoading = true;
      this.cdr.markForCheck();
    }

    try {
      const callerEmail = await this.getCallerEmail();
      if (!callerEmail) {
        throw new Error('Not authenticated');
      }

      const { data: rows, error } = await this.supabase.client.rpc(
        'get_tenant_prayer_encouragement_settings',
        {
          p_tenant_id: tenantId,
          p_email: callerEmail,
        }
      );

      if (error) throw error;

      type EncouragementRow = {
        prayer_encouragement_enabled?: boolean | null;
        prayer_encouragement_cooldown_hours?: number | null;
        prayer_encouragement_count_visible_to_all?: boolean | null;
      };

      const data = (rows as EncouragementRow[] | null)?.[0] ?? null;
      this.prayerEncouragementEnabled = !!data?.prayer_encouragement_enabled;
      const raw = data?.prayer_encouragement_cooldown_hours;
      this.cooldownHours =
        typeof raw === 'number' && raw >= 1 && raw <= 168 ? raw : 4;
      this.countVisibleToAll = !!data?.prayer_encouragement_count_visible_to_all;
      this.errorMessage = '';
    } catch (err) {
      console.error('[PrayerEncouragementSettings] Error loading:', err);
      this.errorMessage = 'Failed to load settings.';
      this.sectionExpanded = true;
    } finally {
      if (!options?.silent) {
        this.isLoading = false;
      }
      this.cdr.markForCheck();
    }
  }

  async submitSettings(): Promise<void> {
    const tenantId = this.activeTenantId;
    if (!tenantId) {
      this.errorMessage = "No active organization selected.";
      return;
    }

    this.isSaving = true;
    this.successMessage = "";
    this.errorMessage = "";

    try {
      const callerEmail = await this.getCallerEmail();
      if (!callerEmail) {
        this.errorMessage = 'Not authenticated.';
        return;
      }

      const cooldown = Math.min(
        168,
        Math.max(1, Math.round(this.cooldownHours))
      );

      const { error } = await this.supabase.client.rpc(
        'update_tenant_prayer_encouragement_settings',
        {
          p_tenant_id: tenantId,
          p_prayer_encouragement_enabled: this.prayerEncouragementEnabled,
          p_prayer_encouragement_cooldown_hours: cooldown,
          p_prayer_encouragement_count_visible_to_all: this.countVisibleToAll,
          p_email: callerEmail,
        }
      );

      if (error) throw error;
      this.cooldownHours = cooldown;

      this.prayerEncouragementService.invalidateFlagCache();
      this.successMessage = 'Prayer Encouragement settings saved.';
      await this.loadSettings({ silent: true });
      setTimeout(() => {
        this.successMessage = "";
        this.cdr.markForCheck();
      }, 5000);
    } catch (err) {
      console.error("[PrayerEncouragementSettings] Error saving:", err);
      this.errorMessage = "Failed to save settings. Please try again.";
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }
}
