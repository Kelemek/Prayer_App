import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { AdminSectionLoadingComponent } from '../admin-section-loading/admin-section-loading.component';
import { AdminCollapsibleSectionComponent } from '../admin-collapsible-section/admin-collapsible-section.component';

type AllowanceLevel = 'everyone' | 'original-requestor' | 'admin-only';

interface AllowanceOption {
  value: AllowanceLevel;
  label: string;
}

@Component({
  selector: 'app-security-policy-settings',
  standalone: true,
  imports: [AdminSectionLoadingComponent, AdminCollapsibleSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-collapsible-section
      title="Security & Access Policies"
      triggerId="security-policy-settings-trigger"
      panelId="security-policy-panel"
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
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>

      @if (loading) {
        <app-admin-section-loading message="Loading security policies…" />
      } @else {
        <!-- Info Box -->
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
          <p class="text-sm text-blue-800 dark:text-blue-200">
            Configure who can submit updates and request deletions for prayer requests.
          </p>
        </div>

        <!-- Error Message -->
        @if (error) {
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-4 mb-4">
          <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
        </div>
        }

        <!-- Settings Box -->
        <div class="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md p-4">
          <div class="space-y-6">
            <!-- Deletions Allowed -->
            <div>
              <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3" id="deletions-policy-label">
                Prayer & Update Deletion Policy
              </h4>
              <div class="relative">
                <div
                  [class.border-blue-500]="showDeletionsDropdown"
                  [class.ring-1]="showDeletionsDropdown"
                  [class.ring-blue-500/40]="showDeletionsDropdown"
                  class="overflow-hidden rounded-md border border-gray-300 bg-white transition-all dark:border-gray-600 dark:bg-gray-800"
                >
                  <button
                    type="button"
                    id="deletionsAllowed"
                    (click)="toggleDeletionsDropdown()"
                    [disabled]="saving"
                    [attr.aria-expanded]="showDeletionsDropdown"
                    aria-haspopup="listbox"
                    aria-labelledby="deletions-policy-label"
                    aria-label="Policy for prayer and update deletions"
                    class="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>{{ getAllowanceLabel(deletionsAllowed) }}</span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="shrink-0 text-gray-600 transition-transform dark:text-gray-400"
                      [class.rotate-180]="showDeletionsDropdown"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </div>

                @if (showDeletionsDropdown) {
                  <div class="fixed inset-0 z-10" (click)="closeDeletionsDropdown()"></div>
                  <div
                    role="listbox"
                    aria-label="Policy for prayer and update deletions"
                    class="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                  >
                    @for (option of allowanceOptions; track option.value) {
                      <button
                        type="button"
                        role="option"
                        [attr.aria-selected]="deletionsAllowed === option.value"
                        (click)="selectDeletionsAllowed(option.value)"
                        class="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-900/30"
                        [class.bg-blue-50]="deletionsAllowed === option.value"
                        [class.dark:bg-blue-900/40]="deletionsAllowed === option.value"
                      >
                        <span>{{ option.label }}</span>
                        @if (deletionsAllowed === option.value) {
                          <span class="ml-2 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true">✓</span>
                        }
                      </button>
                    }
                  </div>
                }
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">
                <strong class="text-gray-700 dark:text-gray-300">Everyone:</strong> Users can request to delete any prayer requests and updates. Deletions require admin approval before taking effect.
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                <strong class="text-gray-700 dark:text-gray-300">Original Requestor Only:</strong> Only the prayer creator can request deletion (verified by email). Admins must approve.
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                <strong class="text-gray-700 dark:text-gray-300">Admin Only:</strong> All delete (trash can) icons are hidden from users. Admins can still delete directly.
              </p>
            </div>

            <!-- Updates Allowed -->
            <div>
              <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3" id="updates-policy-label">
                Prayer Update Policy
              </h4>
              <div class="relative">
                <div
                  [class.border-blue-500]="showUpdatesDropdown"
                  [class.ring-1]="showUpdatesDropdown"
                  [class.ring-blue-500/40]="showUpdatesDropdown"
                  class="overflow-hidden rounded-md border border-gray-300 bg-white transition-all dark:border-gray-600 dark:bg-gray-800"
                >
                  <button
                    type="button"
                    id="updatesAllowed"
                    (click)="toggleUpdatesDropdown()"
                    [disabled]="saving"
                    [attr.aria-expanded]="showUpdatesDropdown"
                    aria-haspopup="listbox"
                    aria-labelledby="updates-policy-label"
                    aria-label="Policy for prayer updates"
                    class="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>{{ getAllowanceLabel(updatesAllowed) }}</span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="shrink-0 text-gray-600 transition-transform dark:text-gray-400"
                      [class.rotate-180]="showUpdatesDropdown"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </div>

                @if (showUpdatesDropdown) {
                  <div class="fixed inset-0 z-10" (click)="closeUpdatesDropdown()"></div>
                  <div
                    role="listbox"
                    aria-label="Policy for prayer updates"
                    class="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                  >
                    @for (option of allowanceOptions; track option.value) {
                      <button
                        type="button"
                        role="option"
                        [attr.aria-selected]="updatesAllowed === option.value"
                        (click)="selectUpdatesAllowed(option.value)"
                        class="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-900/30"
                        [class.bg-blue-50]="updatesAllowed === option.value"
                        [class.dark:bg-blue-900/40]="updatesAllowed === option.value"
                      >
                        <span>{{ option.label }}</span>
                        @if (updatesAllowed === option.value) {
                          <span class="ml-2 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true">✓</span>
                        }
                      </button>
                    }
                  </div>
                }
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">
                <strong class="text-gray-700 dark:text-gray-300">Everyone:</strong> Users can submit updates to any existing prayer requests. Updates require admin approval before being displayed.
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                <strong class="text-gray-700 dark:text-gray-300">Original Requestor Only:</strong> Only the prayer creator can submit updates (verified by email). Admins must approve.
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                <strong class="text-gray-700 dark:text-gray-300">Admin Only:</strong> "Add Update" buttons are hidden from users. Admins can still add updates directly.
              </p>
            </div>
          </div>
        </div>
        <div class="flex justify-end mt-6">
          <button
            (click)="save()"
            [disabled]="saving"
            class="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            @if (saving) {
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Saving...</span>
            }
            @if (!saving) {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            <span>Save Policy Settings</span>
            }
          </button>
        </div>
      }
    </app-admin-collapsible-section>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class SecurityPolicySettingsComponent {
  sectionExpanded = false;
  private sectionInitialLoadDone = false;

  readonly allowanceOptions: AllowanceOption[] = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'original-requestor', label: 'Original Requestor Only' },
    { value: 'admin-only', label: 'Admin Only' },
  ];

  deletionsAllowed: AllowanceLevel = 'everyone';
  updatesAllowed: AllowanceLevel = 'everyone';
  showDeletionsDropdown = false;
  showUpdatesDropdown = false;
  loading = false;
  saving = false;
  error: string | null = null;

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  getAllowanceLabel(value: AllowanceLevel): string {
    switch (value) {
      case 'everyone':
        return 'Everyone';
      case 'original-requestor':
        return 'Original Requestor Only';
      case 'admin-only':
        return 'Admin Only';
      default: {
        const _exhaustive: never = value;
        void _exhaustive;
        return 'Everyone';
      }
    }
  }

  toggleDeletionsDropdown(): void {
    this.showDeletionsDropdown = !this.showDeletionsDropdown;
    if (this.showDeletionsDropdown) {
      this.showUpdatesDropdown = false;
    }
    this.cdr.markForCheck();
  }

  closeDeletionsDropdown(): void {
    this.showDeletionsDropdown = false;
    this.cdr.markForCheck();
  }

  selectDeletionsAllowed(value: AllowanceLevel): void {
    this.deletionsAllowed = value;
    this.showDeletionsDropdown = false;
    this.cdr.markForCheck();
  }

  toggleUpdatesDropdown(): void {
    this.showUpdatesDropdown = !this.showUpdatesDropdown;
    if (this.showUpdatesDropdown) {
      this.showDeletionsDropdown = false;
    }
    this.cdr.markForCheck();
  }

  closeUpdatesDropdown(): void {
    this.showUpdatesDropdown = false;
    this.cdr.markForCheck();
  }

  selectUpdatesAllowed(value: AllowanceLevel): void {
    this.updatesAllowed = value;
    this.showUpdatesDropdown = false;
    this.cdr.markForCheck();
  }

  onExpandedChange(expanded: boolean): void {
    this.sectionExpanded = expanded;
    if (!this.sectionExpanded) {
      this.showDeletionsDropdown = false;
      this.showUpdatesDropdown = false;
    }
    if (this.sectionExpanded && !this.sectionInitialLoadDone) {
      this.sectionInitialLoadDone = true;
      void this.loadSettings();
    }
    this.cdr.markForCheck();
  }

  async loadSettings() {
    try {
      this.loading = true;
      this.error = null;
      this.cdr.markForCheck();

      const { data, error } = await this.supabase.client
        .from('admin_settings')
        .select('deletions_allowed, updates_allowed')
        .eq('id', 1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        this.deletionsAllowed = data.deletions_allowed as AllowanceLevel;
        this.updatesAllowed = data.updates_allowed as AllowanceLevel;
      }

      this.cdr.markForCheck();
    } catch (err: any) {
      console.error('Error loading security policy settings:', err);
      this.error = 'Failed to load settings';
      this.cdr.markForCheck();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async save() {
    try {
      this.saving = true;
      this.error = null;
      this.showDeletionsDropdown = false;
      this.showUpdatesDropdown = false;
      this.cdr.markForCheck();

      const { error } = await this.supabase.client
        .from('admin_settings')
        .update({
          deletions_allowed: this.deletionsAllowed,
          updates_allowed: this.updatesAllowed,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) throw error;

      this.toast.success('Security policy settings saved successfully');
      this.cdr.markForCheck();
    } catch (err: any) {
      console.error('Error saving security policy settings:', err);
      this.error = 'Failed to save settings';
      this.toast.error('Failed to save settings');
      this.cdr.markForCheck();
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }
}
