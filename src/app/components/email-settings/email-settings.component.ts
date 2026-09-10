import { Component, OnInit, OnDestroy, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, distinctUntilChanged, takeUntil } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { AdminSectionLoadingComponent } from '../admin-section-loading/admin-section-loading.component';
import { AdminCollapsibleSectionComponent } from '../admin-collapsible-section/admin-collapsible-section.component';
import {
  coerceMailFromLocalPart,
  mailFromLocalPartError,
  mailFromNameError,
  mailReplyToError,
} from '../../../lib/mail-identity';

@Component({
  selector: 'app-email-settings',
  standalone: true,
  imports: [
    FormsModule,
    AdminSectionLoadingComponent,
    AdminCollapsibleSectionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="space-y-6">
      <app-admin-collapsible-section
        title="Prayer Update Reminders"
        triggerId="prayer-update-reminders-trigger"
        panelId="prayer-update-reminders-panel"
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
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>

        @if (isLoading) {
          <app-admin-section-loading message="Loading reminder settings…" />
        } @else {
          @if (!activeTenantId) {
          <p class="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
            Select an organization above to configure prayer update reminders for that tenant.
          </p>
          } @else {
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Automatically send email reminders to prayer requesters and optionally archive prayers without updates.
          </p>

          <form (ngSubmit)="saveReminderSettings()" class="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <!-- Enable Reminders Checkbox -->
          <label class="flex items-start cursor-pointer mb-4">
            <input
              type="checkbox"
              [(ngModel)]="enableReminders"
              (ngModelChange)="onEnableRemindersChange($event)"
              id="enableReminders"
              name="enableReminders"
              [disabled]="savingReminders"
              aria-label="Enable prayer update reminders"
              class="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Enable prayer update reminders</span>
          </label>

          @if (enableReminders) {
            <!-- Reminder Interval Days -->
            <div class="ml-6 mb-4 pb-4 border-b border-gray-300 dark:border-gray-600">
              <label for="reminder-interval-days" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Days of inactivity before sending reminder email
              </label>
              <div class="flex items-center gap-3">
                <input
                  id="reminder-interval-days"
                  type="number"
                  min="1"
                  max="90"
                  [(ngModel)]="reminderIntervalDays"
                  name="reminderIntervalDays"
                  (ngModelChange)="validateReminderDays(); onFormFieldChange()"
                  aria-label="Days before sending reminder"
                  aria-describedby="reminderDaysHelp"
                  class="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">days</span>
              </div>
              <p id="reminderDaysHelp" class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Send reminder email after this many days without any updates to the prayer.
              </p>
            </div>

            <!-- Auto-Archive Setting -->
            <div class="ml-6">
              <label class="flex items-start cursor-pointer mb-3">
                <input
                  type="checkbox"
                  [(ngModel)]="enableAutoArchive"
                  (ngModelChange)="onEnableAutoArchiveChange($event)"
                  id="enableAutoArchive"
                  name="enableAutoArchive"
                  [disabled]="savingReminders"
                  aria-label="Auto-archive prayers after reminder"
                  class="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Auto-archive prayers after reminder if still no update</span>
              </label>
              
              @if (enableAutoArchive) {
                <div class="ml-6 mb-3">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Days after reminder email before auto-archiving
                  </label>
                  <div class="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="90"
                      [(ngModel)]="daysBeforeArchive"
                      name="daysBeforeArchive"
                      (ngModelChange)="validateArchiveDays(); onFormFieldChange()"
                      aria-label="Days after reminder email before auto-archiving"
                      class="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">days</span>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    After the reminder email is sent, if no update is received within this many days, the prayer will be automatically archived.
                  </p>
                  <div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md">
                    <p class="text-xs text-blue-800 dark:text-blue-200">
                      <strong>Example:</strong> With {{ reminderIntervalDays }} days for reminder and {{ daysBeforeArchive }} days for archive, a prayer with no updates will receive a reminder after {{ reminderIntervalDays }} days, then be archived {{ daysBeforeArchive }} days later (total of {{ reminderIntervalDays + daysBeforeArchive }} days) if still no update.
                    </p>
                  </div>
                </div>
              }
            </div>
          }
        </form>

        @if (successReminders) {
          <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md p-4 mb-4" role="status" aria-live="polite" aria-atomic="true">
            <p class="text-sm text-green-800 dark:text-green-200">
              Reminder settings saved successfully!
            </p>
          </div>
        }

        @if (error) {
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-4 mb-4" role="alert" aria-live="assertive" aria-atomic="true">
            <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
          </div>
        }

        <div class="flex justify-end">
          <button
            type="button"
            (click)="saveReminderSettings()"
            [disabled]="savingReminders"
            class="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            aria-label="Save reminder settings"
          >
            @if (savingReminders) {
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            }
            @if (!savingReminders) {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
            }
            {{ savingReminders ? 'Saving...' : 'Save Reminder Settings' }}
          </button>
        </div>
          }
        }
      </app-admin-collapsible-section>

      <app-admin-collapsible-section
        title="Sending identity"
        triggerId="email-sending-identity-trigger"
        panelId="email-sending-identity-panel"
        [expanded]="identitySectionExpanded"
        (expandedChange)="onIdentityExpandedChange($event)"
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
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>

        @if (isLoadingIdentity) {
          <app-admin-section-loading message="Loading sending identity…" />
        } @else {
          @if (!activeTenantId) {
            <p class="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
              Select an organization above to set this church's From name and address.
            </p>
          } @else {
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Outbound mail for this church uses these fields when set. Leave them blank to send as the platform
              default. Addresses stay on the verified Resend domain; custom sending domains are a later roadmap item.
            </p>

            <form (ngSubmit)="saveMailIdentity()" class="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div class="mb-4">
                <label for="mail-from-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From display name
                </label>
                <input
                  id="mail-from-name"
                  type="text"
                  name="mailFromName"
                  maxlength="78"
                  [(ngModel)]="mailFromName"
                  (ngModelChange)="onIdentityFieldChange()"
                  [disabled]="savingIdentity"
                  placeholder="e.g. Cross Pointe Prayer"
                  aria-describedby="mailFromNameHelp"
                  class="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p id="mailFromNameHelp" class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Shown as the sender name in the inbox. Blank uses the platform default.
                </p>
              </div>

              <div class="mb-4">
                <label for="mail-from-local-part" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From address local-part
                </label>
                <div class="flex flex-wrap items-center gap-2">
                  <input
                    id="mail-from-local-part"
                    type="text"
                    name="mailFromLocalPart"
                    maxlength="64"
                    [(ngModel)]="mailFromLocalPart"
                    (ngModelChange)="onIdentityFieldChange()"
                    [disabled]="savingIdentity"
                    placeholder="e.g. crosspointe"
                    aria-describedby="mailFromLocalPartHelp"
                    class="w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">@your-verified-resend-domain</span>
                </div>
                <p id="mailFromLocalPartHelp" class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Preview: <span class="font-mono">{{ mailFromPreview }}</span>
                </p>
              </div>

              <div class="mb-2">
                <label for="mail-reply-to" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reply-To (optional)
                </label>
                <input
                  id="mail-reply-to"
                  type="email"
                  name="mailReplyTo"
                  maxlength="254"
                  [(ngModel)]="mailReplyTo"
                  (ngModelChange)="onIdentityFieldChange()"
                  [disabled]="savingIdentity"
                  placeholder="e.g. prayer@yourchurch.org"
                  aria-describedby="mailReplyToHelp"
                  class="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p id="mailReplyToHelp" class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  A real church inbox. Not required to be on the Resend domain. List-Unsubscribe still uses the platform address.
                </p>
              </div>
            </form>

            @if (successIdentity) {
              <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md p-4 mb-4" role="status" aria-live="polite" aria-atomic="true">
                <p class="text-sm text-green-800 dark:text-green-200">
                  Sending identity saved.
                </p>
              </div>
            }

            @if (identityError) {
              <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-4 mb-4" role="alert" aria-live="assertive" aria-atomic="true">
                <p class="text-sm text-red-800 dark:text-red-200">{{ identityError }}</p>
              </div>
            }

            <div class="flex justify-end">
              <button
                type="button"
                (click)="saveMailIdentity()"
                [disabled]="savingIdentity"
                class="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Save sending identity"
              >
                @if (savingIdentity) {
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                }
                {{ savingIdentity ? 'Saving...' : 'Save sending identity' }}
              </button>
            </div>
          }
        }
      </app-admin-collapsible-section>
    </div>
  `,
  styles: []
})
export class EmailSettingsComponent implements OnInit, OnDestroy {
  @Output() onSave = new EventEmitter<void>();

  private readonly destroy$ = new Subject<void>();

  get activeTenantId(): string | null {
    return this.tenantContext.getActiveTenant()?.id ?? null;
  }

  sectionExpanded = false;
  private sectionInitialLoadDone = false;
  private settingsLoadedForTenantId: string | null = null;
  isLoading = false;

  enableReminders = false;
  reminderIntervalDays = 7;
  enableAutoArchive = false;
  daysBeforeArchive = 7;

  private static readonly DEFAULT_REMINDER_DAYS = 7;
  private static readonly DEFAULT_ARCHIVE_DAYS = 7;

  savingReminders = false;
  error: string | null = null;
  successVerification = false;
  successReminders = false;

  identitySectionExpanded = false;
  private identityInitialLoadDone = false;
  private identityLoadedForTenantId: string | null = null;
  isLoadingIdentity = false;
  savingIdentity = false;
  successIdentity = false;
  identityError: string | null = null;
  mailFromName = '';
  mailFromLocalPart = '';
  mailReplyTo = '';

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private tenantContext: TenantContextService
  ) {}

  ngOnInit() {
    this.tenantContext.activeTenant$
      .pipe(
        distinctUntilChanged((a, b) => a?.id === b?.id),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (!this.activeTenantId) {
          this.resetReminderState();
          this.resetIdentityState();
          this.settingsLoadedForTenantId = null;
          this.identityLoadedForTenantId = null;
        } else {
          if (this.sectionExpanded) {
            void this.loadSettings();
          }
          if (this.identitySectionExpanded) {
            void this.loadMailIdentity();
          }
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onExpandedChange(expanded: boolean): void {
    this.sectionExpanded = expanded;
    const tenantId = this.activeTenantId;
    if (this.sectionExpanded && tenantId) {
      const shouldLoad =
        !this.sectionInitialLoadDone ||
        this.settingsLoadedForTenantId !== tenantId;
      if (shouldLoad) {
        this.sectionInitialLoadDone = true;
        void this.loadSettings();
      }
    }
    this.cdr.markForCheck();
  }

  get mailFromPreview(): string {
    const local = coerceMailFromLocalPart(this.mailFromLocalPart);
    if (local) {
      return `${local}@your-verified-resend-domain`;
    }
    return 'Platform default (MAIL_SENDER_ADDRESS)';
  }

  onIdentityExpandedChange(expanded: boolean): void {
    this.identitySectionExpanded = expanded;
    const tenantId = this.activeTenantId;
    if (this.identitySectionExpanded && tenantId) {
      const shouldLoad =
        !this.identityInitialLoadDone ||
        this.identityLoadedForTenantId !== tenantId;
      if (shouldLoad) {
        this.identityInitialLoadDone = true;
        void this.loadMailIdentity();
      }
    }
    this.cdr.markForCheck();
  }

  onIdentityFieldChange(): void {
    this.successIdentity = false;
    this.identityError = null;
    this.cdr.markForCheck();
  }

  private resetIdentityState(): void {
    this.mailFromName = '';
    this.mailFromLocalPart = '';
    this.mailReplyTo = '';
    this.identityError = null;
    this.successIdentity = false;
  }

  async loadMailIdentity(options?: { silent?: boolean }): Promise<void> {
    const tenantId = this.activeTenantId;
    if (!tenantId) {
      return;
    }
    try {
      if (!options?.silent) {
        this.isLoadingIdentity = true;
        this.cdr.markForCheck();
      }
      this.identityError = null;

      const callerEmail = await this.getCallerEmail();
      if (!callerEmail) {
        throw new Error('Not authenticated');
      }

      type MailIdentityRow = {
        mail_from_name?: string | null;
        mail_from_local_part?: string | null;
        mail_reply_to?: string | null;
      };

      const { data: rows, error } = await this.supabase.client.rpc('get_tenant_mail_identity', {
        p_tenant_id: tenantId,
        p_email: callerEmail
      });
      if (error) throw error;
      const data = (rows as MailIdentityRow[] | null)?.[0] ?? null;
      this.mailFromName = data?.mail_from_name?.trim() ?? '';
      this.mailFromLocalPart = data?.mail_from_local_part?.trim() ?? '';
      this.mailReplyTo = data?.mail_reply_to?.trim() ?? '';
      this.identityLoadedForTenantId = tenantId;
    } catch (err: unknown) {
      console.error('Error loading sending identity:', err);
      const message = err && typeof err === 'object' && 'message' in err
        ? String(err.message)
        : 'Unknown error';
      this.identityError = `Failed to load sending identity: ${message}`;
      this.cdr.markForCheck();
    } finally {
      if (!options?.silent) {
        this.isLoadingIdentity = false;
      }
      this.cdr.markForCheck();
    }
  }

  async saveMailIdentity(): Promise<void> {
    const tenantId = this.activeTenantId;
    if (!tenantId) {
      this.toast.error('Select an organization first');
      return;
    }

    const nameErr = mailFromNameError(this.mailFromName);
    const localErr = mailFromLocalPartError(this.mailFromLocalPart);
    const replyErr = mailReplyToError(this.mailReplyTo);
    const validationError = nameErr ?? localErr ?? replyErr;
    if (validationError) {
      this.identityError = validationError;
      this.cdr.markForCheck();
      this.toast.error(validationError);
      return;
    }

    try {
      this.savingIdentity = true;
      this.cdr.markForCheck();
      this.identityError = null;
      this.successIdentity = false;

      const callerEmail = await this.getCallerEmail();
      if (!callerEmail) {
        this.toast.error('Not authenticated');
        return;
      }

      const { error } = await this.supabase.client.rpc('update_tenant_mail_identity', {
        p_tenant_id: tenantId,
        p_mail_from_name: this.mailFromName.trim() || null,
        p_mail_from_local_part: this.mailFromLocalPart.trim().toLowerCase() || null,
        p_mail_reply_to: this.mailReplyTo.trim() || null,
        p_email: callerEmail
      });
      if (error) throw error;

      this.successIdentity = true;
      this.cdr.markForCheck();
      this.toast.success('Sending identity saved.');
      this.onSave.emit();
      await this.loadMailIdentity({ silent: true });

      setTimeout(() => {
        this.successIdentity = false;
        this.cdr.markForCheck();
      }, 3000);
    } catch (err: unknown) {
      console.error('Error saving sending identity:', err);
      const message = err && typeof err === 'object' && 'message' in err
        ? String(err.message)
        : 'Unknown error';
      this.identityError = `Failed to save sending identity: ${message}`;
      this.cdr.markForCheck();
      this.toast.error('Failed to save sending identity');
    } finally {
      this.savingIdentity = false;
      this.cdr.markForCheck();
    }
  }

  onFormFieldChange(): void {
    this.successReminders = false;
    this.cdr.markForCheck();
  }

  onEnableRemindersChange(enabled: boolean): void {
    this.enableReminders = enabled;
    if (!enabled) {
      this.enableAutoArchive = false;
    } else {
      this.reminderIntervalDays = this.normalizeDays(
        this.reminderIntervalDays,
        EmailSettingsComponent.DEFAULT_REMINDER_DAYS
      );
    }
    this.onFormFieldChange();
  }

  onEnableAutoArchiveChange(enabled: boolean): void {
    this.enableAutoArchive = enabled;
    if (enabled) {
      this.daysBeforeArchive = this.normalizeDays(
        this.daysBeforeArchive,
        EmailSettingsComponent.DEFAULT_ARCHIVE_DAYS
      );
    }
    this.onFormFieldChange();
  }

  private normalizeDays(value: unknown, fallback: number): number {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    if (parsed < 1) {
      return 1;
    }
    return Math.min(90, Math.round(parsed));
  }

  private async getCallerEmail(): Promise<string | null> {
    const { data: { session } } = await this.supabase.client.auth.getSession();
    return session?.user?.email?.toLowerCase().trim() || null;
  }

  private resetReminderState(): void {
    this.enableReminders = false;
    this.reminderIntervalDays = 7;
    this.enableAutoArchive = false;
    this.daysBeforeArchive = 7;
    this.error = null;
    this.successReminders = false;
  }

  async loadSettings(options?: { silent?: boolean }) {
    const tenantId = this.activeTenantId;
    if (!tenantId) {
      return;
    }
    try {
      if (!options?.silent) {
        this.isLoading = true;
        this.cdr.markForCheck();
      }
      this.error = null;

      const callerEmail = await this.getCallerEmail();
      if (!callerEmail) {
        throw new Error('Not authenticated');
      }

      type ReminderSettingsRow = {
        enable_reminders?: boolean | null;
        reminder_interval_days?: number | null;
        enable_auto_archive?: boolean | null;
        days_before_archive?: number | null;
      };

      let data: ReminderSettingsRow | null = null;

      const { data: rows, error } = await this.supabase.client.rpc('get_tenant_reminder_settings', {
        p_tenant_id: tenantId,
        p_email: callerEmail
      });
      if (error) throw error;
      data = (rows as ReminderSettingsRow[] | null)?.[0] ?? null;

      if (data) {
        if (data.enable_reminders !== null && data.enable_reminders !== undefined) {
          this.enableReminders = data.enable_reminders;
        }
        if (data.reminder_interval_days !== null && data.reminder_interval_days !== undefined) {
          this.reminderIntervalDays = this.normalizeDays(
            data.reminder_interval_days,
            EmailSettingsComponent.DEFAULT_REMINDER_DAYS
          );
        }
        if (data.enable_auto_archive !== null && data.enable_auto_archive !== undefined) {
          this.enableAutoArchive = data.enable_auto_archive;
        }
        if (data.days_before_archive !== null && data.days_before_archive !== undefined) {
          this.daysBeforeArchive = this.normalizeDays(
            data.days_before_archive,
            EmailSettingsComponent.DEFAULT_ARCHIVE_DAYS
          );
        }
      }
      this.settingsLoadedForTenantId = tenantId;
    } catch (err: unknown) {
      console.error('Error loading email settings:', err);
      const message = err && typeof err === 'object' && 'message' in err
        ? String(err.message)
        : 'Unknown error';
      this.error = `Failed to load email settings: ${message}`;
      this.cdr.markForCheck();
    } finally {
      if (!options?.silent) {
        this.isLoading = false;
      }
      this.cdr.markForCheck();
    }
  }

  async saveReminderSettings() {
    const tenantId = this.activeTenantId;
    if (!tenantId) {
      this.toast.error('Select an organization first');
      return;
    }
    try {
      this.savingReminders = true;
      this.cdr.markForCheck();
      this.error = null;
      this.successReminders = false;

      const callerEmail = await this.getCallerEmail();
      if (!callerEmail) {
        this.toast.error('Not authenticated');
        return;
      }

      const { error } = await this.supabase.client.rpc('update_tenant_reminder_settings', {
        p_tenant_id: tenantId,
        p_enable_reminders: this.enableReminders,
        p_reminder_interval_days: this.reminderIntervalDays,
        p_enable_auto_archive: this.enableAutoArchive,
        p_days_before_archive: this.daysBeforeArchive,
        p_email: callerEmail
      });
      if (error) throw error;

      this.successReminders = true;
      this.cdr.markForCheck();
      this.toast.success('Prayer reminder settings saved!');
      this.onSave.emit();
      await this.loadSettings({ silent: true });

      setTimeout(() => {
        this.successReminders = false;
        this.cdr.markForCheck();
      }, 3000);
    } catch (err: unknown) {
      console.error('Error saving reminder settings:', err);
      const message = err && typeof err === 'object' && 'message' in err
        ? String(err.message)
        : 'Unknown error';
      this.error = `Failed to save reminder settings: ${message}`;
      this.cdr.markForCheck();
      this.toast.error('Failed to save reminder settings');
    } finally {
      this.savingReminders = false;
      this.cdr.markForCheck();
    }
  }

  validateReminderDays() {
    this.reminderIntervalDays = this.normalizeDays(
      this.reminderIntervalDays,
      EmailSettingsComponent.DEFAULT_REMINDER_DAYS
    );
  }

  validateArchiveDays() {
    this.daysBeforeArchive = this.normalizeDays(
      this.daysBeforeArchive,
      EmailSettingsComponent.DEFAULT_ARCHIVE_DAYS
    );
  }
}
