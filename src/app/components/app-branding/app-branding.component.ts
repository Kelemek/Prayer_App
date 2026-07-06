import { Component, OnInit, OnDestroy, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';
import { BrandingService } from '../../services/branding.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { AdminSectionLoadingComponent } from '../admin-section-loading/admin-section-loading.component';
import { AdminCollapsibleSectionComponent } from '../admin-collapsible-section/admin-collapsible-section.component';

@Component({
  selector: 'app-branding',
  standalone: true,
  imports: [FormsModule, AdminSectionLoadingComponent, AdminCollapsibleSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-collapsible-section
      title="App Branding"
      triggerId="app-branding-trigger"
      panelId="app-branding-panel"
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
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>

      @if (isLoading) {
        <app-admin-section-loading message="Loading branding settings…" />
      } @else {
        @if (!activeTenantId) {
          <p class="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
            Select an organization above to edit branding for that tenant.
          </p>
        } @else {
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Customize the title and logo displayed at the top of your app.
          </p>

          <div class="space-y-4">
            <!-- Error Message -->
            @if (error) {
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-4 mb-4">
              <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
            </div>
            }
            <!-- App Title -->
            <div>
              <label for="appTitle" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                App Title
              </label>
              <input
                type="text"
                id="appTitle"
                [(ngModel)]="appTitle"
                name="appTitle"
                aria-label="Application title"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Church Prayer Manager"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Main heading displayed in the app header
              </p>
            </div>

            <!-- Logo Settings -->
            <div class="space-y-4">
              <label
                class="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  id="useLogo"
                  [checked]="useLogo"
                  (click)="onUseLogoClick($event)"
                  name="useLogo"
                  aria-label="Use custom logo instead of app title"
                  class="h-4 w-4 text-blue-600 border-gray-300 bg-white dark:bg-gray-800 rounded focus:ring-blue-500 cursor-pointer focus:ring-2"
                />
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Use custom logo instead of app title
                </span>
              </label>

              @if (useLogo) {
              <div class="space-y-4 pl-7">
                <!-- Light Mode Logo -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Light Mode Logo
                  </label>
                  <div class="flex items-start gap-3">
                    <input
                      type="file"
                      #lightLogoInput
                      accept="image/*"
                      (change)="onLogoUpload($event, 'light')"
                      class="hidden"
                    />
                    <button
                      (click)="lightLogoInput.click()"
                      [disabled]="uploading"
                      class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      aria-label="Upload light mode logo"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      Upload
                    </button>
                    @if (lightModeLogoUrl) {
                    <button
                      (click)="lightModeLogoUrl = ''"
                      class="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors cursor-pointer"
                      aria-label="Remove light mode logo"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Remove
                    </button>
                    }
                  </div>
                  @if (lightModeLogoUrl) {
                  <div class="mt-3 p-3 rounded-lg border border-gray-300 bg-white">
                    <p class="text-xs font-medium text-gray-700 mb-2">Preview (Light Mode):</p>
                    <img
                      [src]="lightModeLogoUrl"
                      alt="Light mode logo preview"
                      class="h-16 w-auto max-w-xs"
                    />
                  </div>
                  }
                </div>

                <!-- Dark Mode Logo -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dark Mode Logo
                  </label>
                  <div class="flex items-start gap-3">
                    <input
                      type="file"
                      #darkLogoInput
                      accept="image/*"
                      (change)="onLogoUpload($event, 'dark')"
                      class="hidden"
                    />
                    <button
                      (click)="darkLogoInput.click()"
                      [disabled]="uploading"
                      class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      aria-label="Upload dark mode logo"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      Upload
                    </button>
                    @if (darkModeLogoUrl) {
                    <button
                      (click)="darkModeLogoUrl = ''"
                      class="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors cursor-pointer"
                      aria-label="Remove dark mode logo"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Remove
                    </button>
                    }
                  </div>
                  @if (darkModeLogoUrl) {
                  <div class="mt-3 p-3 rounded-lg border border-gray-700" style="background-color: #1f2937;">
                    <p class="text-xs font-medium text-gray-300 mb-2">Preview (Dark Mode):</p>
                    <img
                      [src]="darkModeLogoUrl"
                      alt="Dark mode logo preview"
                      class="h-16 w-auto max-w-xs"
                    />
                  </div>
                  }
                </div>
              </div>
              }
            </div>

            <!-- Save Button -->
            <div class="flex justify-end gap-3 mt-6">
              <button
                (click)="save()"
                [disabled]="saving"
                class="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                @if (saving) {
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                }
                @if (!saving) {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  Save Branding Settings
                }
              </button>
            </div>

            <!-- Success Message -->
            @if (success) {
            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md p-4 mt-4">
              <p class="text-sm text-green-800 dark:text-green-200">
                Branding settings saved successfully!
              </p>
            </div>
            }
          </div>
        }
      }
    </app-admin-collapsible-section>
  `,
  styles: []
})
export class AppBrandingComponent implements OnInit, OnDestroy {
  @Output() onSave = new EventEmitter<void>();

  private readonly destroy$ = new Subject<void>();

  sectionExpanded = false;
  private sectionInitialLoadDone = false;
  isLoading = false;

  get activeTenantId(): string | null {
    return this.tenantContext.getActiveTenant()?.id ?? null;
  }

  appTitle = 'Church Prayer Manager';
  useLogo = false;
  lightModeLogoUrl = '';
  darkModeLogoUrl = '';
  saving = false;
  uploading = false;
  error: string | null = null;
  success = false;

  constructor(
    private supabase: SupabaseService,
    private brandingService: BrandingService,
    private cdr: ChangeDetectorRef,
    private tenantContext: TenantContextService
  ) {}

  ngOnInit() {
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

  ngOnDestroy() {
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

  private resetFormState(): void {
    this.appTitle = 'Church Prayer Manager';
    this.useLogo = false;
    this.lightModeLogoUrl = '';
    this.darkModeLogoUrl = '';
    this.error = null;
    this.success = false;
  }

  onUseLogoClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.saving || this.uploading) {
      return;
    }
    this.useLogo = !this.useLogo;
    this.cdr.markForCheck();
  }

  private async getCallerEmail(): Promise<string | null> {
    const { data: { session } } = await this.supabase.client.auth.getSession();
    return session?.user?.email?.toLowerCase().trim() || null;
  }

  async loadSettings() {
    const tenantId = this.activeTenantId;
    if (!tenantId) {
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();
    this.error = null;

    try {
      const callerEmail = await this.getCallerEmail();
      if (!callerEmail) {
        throw new Error('Not authenticated');
      }

      const { data: rows, error } = await this.supabase.client.rpc(
        'get_tenant_branding_settings',
        {
          p_tenant_id: tenantId,
          p_email: callerEmail,
        }
      );

      if (error) throw error;

      type BrandingRow = {
        app_title?: string | null;
        use_logo?: boolean | null;
        light_mode_logo_blob?: string | null;
        dark_mode_logo_blob?: string | null;
      };

      const data = (rows as BrandingRow[] | null)?.[0] ?? null;

      if (data) {
        if (data.app_title) this.appTitle = data.app_title;
        if (data.use_logo !== null && data.use_logo !== undefined) {
          this.useLogo = data.use_logo;
        }
        if (data.light_mode_logo_blob) {
          this.lightModeLogoUrl = data.light_mode_logo_blob;
        }
        if (data.dark_mode_logo_blob) {
          this.darkModeLogoUrl = data.dark_mode_logo_blob;
        }
      }
    } catch (err: any) {
      console.error('Error loading branding settings:', err);
      this.error = 'Failed to load branding settings';
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  onLogoUpload(event: Event, mode: 'light' | 'dark') {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading = true;
    this.cdr.markForCheck();
    this.error = null;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target?.result as string;
      if (mode === 'light') {
        this.lightModeLogoUrl = base64String;
      } else {
        this.darkModeLogoUrl = base64String;
      }
      this.uploading = false;
      this.cdr.markForCheck();
    };
    reader.onerror = () => {
      this.error = 'Failed to read image file';
      this.uploading = false;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  async save() {
    const tenantId = this.activeTenantId;
    if (!tenantId) {
      this.error = 'No active organization selected.';
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();
    this.error = null;
    this.success = false;

    try {
      const callerEmail = await this.getCallerEmail();
      if (!callerEmail) {
        this.error = 'Not authenticated.';
        return;
      }

      const { error } = await this.supabase.client.rpc(
        'update_tenant_branding_settings',
        {
          p_tenant_id: tenantId,
          p_app_title: this.appTitle,
          p_use_logo: this.useLogo,
          p_light_mode_logo_blob: this.lightModeLogoUrl || null,
          p_dark_mode_logo_blob: this.darkModeLogoUrl || null,
          p_email: callerEmail,
        }
      );

      if (error) throw error;

      this.success = true;
      this.cdr.markForCheck();

      this.brandingService.applySavedBranding({
        useLogo: this.useLogo,
        lightLogo: this.lightModeLogoUrl || null,
        darkLogo: this.darkModeLogoUrl || null,
        appTitle: this.appTitle,
        lastModified: new Date(),
      });
      this.onSave.emit();

      setTimeout(() => {
        this.success = false;
        this.cdr.markForCheck();
      }, 3000);
    } catch (err: any) {
      console.error('Error saving branding settings:', err);
      this.error = err?.message || 'Failed to save settings. Please try again.';
      this.cdr.markForCheck();
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }
}
