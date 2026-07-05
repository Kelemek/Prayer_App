import {
  Component,
  Output,
  EventEmitter,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subject, distinctUntilChanged, takeUntil } from "rxjs";
import { SupabaseService } from "../../services/supabase.service";
import { ToastService } from "../../services/toast.service";
import { EmailNotificationService } from "../../services/email-notification.service";
import { TenantContextService } from "../../services/tenant-context.service";
import { ConfirmationDialogComponent } from "../confirmation-dialog/confirmation-dialog.component";
import { AdminSectionLoadingComponent } from "../admin-section-loading/admin-section-loading.component";
import { AdminCollapsibleSectionComponent } from "../admin-collapsible-section/admin-collapsible-section.component";

interface AdminUser {
  email: string;
  name: string;
  created_at: string;
  receive_admin_emails: boolean;
  receive_admin_push: boolean;
}

@Component({
  selector: "app-admin-user-management",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ConfirmationDialogComponent,
    AdminSectionLoadingComponent,
    AdminCollapsibleSectionComponent,
  ],
  template: `
    <app-admin-collapsible-section
      title="Admin User Management"
      triggerId="admin-user-management-trigger"
      panelId="admin-user-management-panel"
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
        <app-admin-section-loading message="Loading admin users…" />
      } @else {
      <div class="flex items-center justify-between mb-6 min-h-[3.5rem]">
        <p
          class="text-sm text-gray-600 dark:text-gray-400 leading-tight"
        >
          Manage admin users and send invitations
        </p>

        @if (!showAddForm) {
        <button
          (click)="showAddForm = true"
          class="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer flex-shrink-0 self-center"
          title="Click to add a new administrator. You will be able to enter their email address and send them an invitation to join as an admin."
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
          Add Admin
        </button>
        }
      </div>

      <!-- Success Message -->
      @if (success) {
      <div
        class="mb-4 flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
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
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <div class="flex-1">
          <p class="text-green-800 dark:text-green-200 text-sm">
            {{ success }}
          </p>
        </div>
        <button
          (click)="dismissSuccessMessage()"
          class="text-green-600 dark:text-green-400 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-md p-1"
          aria-label="Close success message"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      }

      <!-- Error Message -->
      @if (error) {
      <div
        class="mb-4 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
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
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div class="flex-1">
          <p class="text-red-800 dark:text-red-200 text-sm">{{ error }}</p>
        </div>
        <button
          (click)="error = null"
          class="text-red-600 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md p-1"
          aria-label="Close error message"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      }

      <!-- Add Admin Form -->
      @if (showAddForm) {
      <div
        class="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700 rounded-lg"
      >
        <div class="flex items-center justify-between mb-4">
          <h4 class="text-md font-semibold text-gray-900 dark:text-gray-100">
            Add New Admin
          </h4>
          <button
            (click)="cancelAddForm()"
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label
              for="adminName"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Name <span aria-label="required">*</span>
            </label>
            <input
              type="text"
              id="adminName"
              [(ngModel)]="newAdminName"
              placeholder="Admin's full name"
              aria-label="Admin's full name"
              aria-required="true"
              class="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:ring-offset-0"
            />
          </div>

          <div>
            <label
              for="adminEmail"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email Address <span aria-label="required">*</span>
            </label>
            <input
              type="email"
              id="adminEmail"
              [(ngModel)]="newAdminEmail"
              placeholder="admin@example.com"
              aria-label="Admin's email address"
              aria-required="true"
              class="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:ring-offset-0"
            />
          </div>

          <div class="flex gap-3">
            <button
              (click)="addAdmin()"
              [disabled]="adding"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Add new admin user"
              title="Send an invitation email to the entered email address. The user will need to accept the invitation to become an administrator."
            >
              @if (adding) {
              <div
                class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
              ></div>
              } @if (!adding) {
              <svg
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
                  d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                ></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              }
              {{ adding ? "Adding..." : "Add & Send Invitation" }}
            </button>
            <button
              (click)="cancelAddForm()"
              [disabled]="adding"
              class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              aria-label="Cancel adding new admin"
              title="Close the add admin form without making any changes."
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      }
      <!-- Admin List -->
      @if (!loading && admins.length === 0) {
      <div class="text-center py-8 text-gray-500 dark:text-gray-400">
        <svg
          class="mx-auto mb-2 opacity-50"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
        <p>No admin users found</p>
      </div>
      } @if (!loading && admins.length > 0) {
      <!-- Table header -->
      <div
        class="flex items-center justify-between p-4 pb-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600"
      >
        <div class="flex-1">
          <div class="font-medium text-gray-700 dark:text-gray-300">Admin</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-10 text-center" title="Email notifications"
            >Email</span
          >
          <span class="w-10 text-center" title="Push notifications">Push</span>
          <span class="w-10 text-center">Actions</span>
        </div>
      </div>
      <div class="space-y-3 mt-2">
        @for (admin of admins; track admin.email) {
        <div
          class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
        >
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <svg
                class="text-red-600 dark:text-red-400"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <h4 class="font-medium text-gray-900 dark:text-gray-100">
                {{ admin.name }}
              </h4>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {{ admin.email }}
            </p>
            <div
              class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500"
            >
              <span> Added: {{ formatDate(admin.created_at) }} </span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Receive Admin Emails Toggle -->
            <button
              (click)="
                handleToggleReceiveEmails(
                  admin.email,
                  admin.name,
                  admin.receive_admin_emails
                )
              "
              [class]="
                'p-2 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ' +
                (admin.receive_admin_emails
                  ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 focus:ring-green-500'
                  : 'text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-gray-500')
              "
              [attr.aria-label]="
                'Email notifications for ' +
                admin.name +
                ' are ' +
                (admin.receive_admin_emails ? 'enabled' : 'disabled')
              "
              [attr.aria-pressed]="admin.receive_admin_emails"
              [title]="
                admin.receive_admin_emails
                  ? 'Click to disable email notifications for ' +
                    admin.name +
                    '. They will no longer receive admin alerts and updates.'
                  : 'Click to enable email notifications for ' +
                    admin.name +
                    '. They will receive admin alerts and updates about prayers and system events.'
              "
            >
              @if (admin.receive_admin_emails) {
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              } @if (!admin.receive_admin_emails) {
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              }
            </button>
            <!-- Receive Admin Push Toggle -->
            <button
              (click)="
                handleToggleReceivePush(
                  admin.email,
                  admin.name,
                  admin.receive_admin_push
                )
              "
              [class]="
                'p-2 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ' +
                (admin.receive_admin_push
                  ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 focus:ring-green-500'
                  : 'text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-gray-500')
              "
              [attr.aria-label]="
                'Push notifications for ' +
                admin.name +
                ' are ' +
                (admin.receive_admin_push ? 'enabled' : 'disabled')
              "
              [attr.aria-pressed]="admin.receive_admin_push"
              [title]="
                admin.receive_admin_push
                  ? 'Click to disable push notifications for ' +
                    admin.name +
                    '.'
                  : 'Click to enable push notifications for ' +
                    admin.name +
                    '. They will receive admin alerts on their device.'
              "
            >
              @if (admin.receive_admin_push) {
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              } @if (!admin.receive_admin_push) {
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              }
            </button>
            <!-- Delete Admin Button -->
            <button
              (click)="handleDeleteAdmin(admin.email, admin.name)"
              [disabled]="admins.length === 1"
              class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 cursor-pointer"
              [attr.aria-label]="
                admins.length === 1
                  ? 'Cannot delete, this is the last admin'
                  : 'Remove admin access for ' + admin.name
              "
              [title]="
                admins.length === 1
                  ? 'Cannot remove the last admin. At least one admin must be present to manage the application.'
                  : 'Click to remove admin access for ' +
                    admin.name +
                    '. You will be asked to confirm this action.'
              "
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="3 6 5 6 21 6"></polyline>
                <path
                  d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                ></path>
              </svg>
            </button>
          </div>
        </div>
        }
      </div>
      }

      <!-- Summary and Notes -->
      @if (admins.length > 0) {
      <div
        class="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md"
      >
        <p class="text-sm text-gray-700 dark:text-gray-300">
          <strong>{{ getReceivingEmailsCount() }}</strong> of
          <strong>{{ admins.length }}</strong> admin{{
            admins.length !== 1 ? "s" : ""
          }}
          receiving email notifications;
          <strong>{{ getReceivingPushCount() }}</strong> of
          <strong>{{ admins.length }}</strong> receiving push notifications.
        </p>
      </div>
      }

      <div
        class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md"
      >
        <p class="text-xs text-blue-800 dark:text-blue-200">
          <strong>Note:</strong> Tenant admins sign in with a 6-digit code sent
          to their email. When you add a new admin, they'll receive an
          invitation email with instructions. Click the green checkmarks to
          enable/disable admin email and push notifications.
        </p>
      </div>
      }
    </app-admin-collapsible-section>

    @if (showConfirmationDialog) {
      <app-confirmation-dialog
        [title]="confirmationTitle"
        [message]="confirmationMessage"
        [details]="confirmationDetails"
        [isDangerous]="confirmationIsDangerous"
        [confirmText]="confirmationConfirmText"
        (confirm)="onConfirmDialog()"
        (cancel)="onCancelDialog()"
      >
      </app-confirmation-dialog>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [],
})
export class AdminUserManagementComponent implements OnInit, OnDestroy {
  @Output() onSave = new EventEmitter<void>();

  private static readonly SUCCESS_DISMISS_MS = 5000;
  private successDismissTimer: ReturnType<typeof setTimeout> | null = null;
  private destroy$ = new Subject<void>();

  sectionExpanded = false;
  private sectionInitialLoadDone = false;
  private adminsLoadedForTenantId: string | null = null;

  admins: AdminUser[] = [];
  loading = false;
  error: string | null = null;
  success: string | null = null;

  showAddForm = false;
  newAdminEmail = "";
  newAdminName = "";
  adding = false;

  showConfirmationDialog = false;
  confirmationTitle = "";
  confirmationMessage = "";
  confirmationDetails: string | null = null;
  confirmationConfirmText = "Confirm";
  confirmationIsDangerous = false;
  confirmationAction: (() => Promise<void>) | null = null;

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private emailService: EmailNotificationService,
    private tenantContext: TenantContextService
  ) {}

  ngOnInit(): void {
    this.tenantContext.activeTenant$
      .pipe(
        distinctUntilChanged((a, b) => a?.id === b?.id),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (!this.getActiveTenantId()) {
          this.resetForNoTenant();
        } else if (this.sectionExpanded) {
          void this.loadAdmins();
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.clearSuccessDismissTimer();
    this.destroy$.next();
    this.destroy$.complete();
  }

  showSuccessMessage(message: string): void {
    this.clearSuccessDismissTimer();
    this.success = message;
    this.successDismissTimer = setTimeout(() => {
      this.success = null;
      this.successDismissTimer = null;
      this.cdr.markForCheck();
    }, AdminUserManagementComponent.SUCCESS_DISMISS_MS);
    this.cdr.markForCheck();
  }

  dismissSuccessMessage(): void {
    this.clearSuccessDismissTimer();
    this.success = null;
    this.cdr.markForCheck();
  }

  private clearSuccess(): void {
    this.clearSuccessDismissTimer();
    this.success = null;
  }

  private clearSuccessDismissTimer(): void {
    if (this.successDismissTimer !== null) {
      clearTimeout(this.successDismissTimer);
      this.successDismissTimer = null;
    }
  }

  onExpandedChange(expanded: boolean): void {
    this.sectionExpanded = expanded;
    const tenantId = this.getActiveTenantId();
    if (this.sectionExpanded && tenantId) {
      const shouldLoad =
        !this.sectionInitialLoadDone ||
        this.adminsLoadedForTenantId !== tenantId;
      if (shouldLoad) {
        this.sectionInitialLoadDone = true;
        void this.loadAdmins();
      }
    }
    this.cdr.markForCheck();
  }

  private resetForNoTenant(): void {
    this.admins = [];
    this.adminsLoadedForTenantId = null;
    this.error = null;
    this.clearSuccess();
  }

  private getActiveTenantId(): string | null {
    return this.tenantContext.getActiveTenant()?.id ?? null;
  }

  private mapMembershipToAdmin(row: {
    user_email: string;
    name: string;
    created_at: string;
    receive_admin_emails: boolean;
    receive_admin_push: boolean;
  }): AdminUser {
    return {
      email: row.user_email,
      name: row.name,
      created_at: row.created_at,
      receive_admin_emails: row.receive_admin_emails,
      receive_admin_push: row.receive_admin_push,
    };
  }

  private async isSuperAdminEmail(email: string): Promise<boolean> {
    const { data, error } = await this.supabase.client.rpc("is_super_admin", {
      email_to_check: email,
    });
    if (error) {
      console.warn("is_super_admin check failed:", error);
      return false;
    }
    return data === true;
  }

  private async filterTenantAdminsExcludingSuper(
    rows: Array<{
      user_email: string;
      name: string;
      created_at: string;
      receive_admin_emails: boolean;
      receive_admin_push: boolean;
    }>
  ): Promise<AdminUser[]> {
    const checks = await Promise.all(
      rows.map(async (row) => ({
        row,
        isSuper: await this.isSuperAdminEmail(row.user_email),
      }))
    );
    return checks
      .filter(({ isSuper }) => !isSuper)
      .map(({ row }) => this.mapMembershipToAdmin(row));
  }

  async loadAdmins() {
    const tenantId = this.getActiveTenantId();
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    if (!tenantId) {
      this.admins = [];
      this.adminsLoadedForTenantId = null;
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    try {
      const { data, error } = await this.supabase.client
        .from("tenant_memberships")
        .select(
          "user_email,name,created_at,receive_admin_emails,receive_admin_push"
        )
        .eq("tenant_id", tenantId)
        .eq("role", "tenant_admin")
        .order("created_at", { ascending: true });

      if (error) throw error;

      this.admins = await this.filterTenantAdminsExcludingSuper(data ?? []);
      this.adminsLoadedForTenantId = tenantId;
      this.cdr.markForCheck();
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : String(err);
      console.error("Error loading admins:", err);
      this.error = "Failed to load admin users";
      this.cdr.markForCheck();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async addAdmin() {
    if (!this.newAdminEmail.trim() || !this.newAdminName.trim()) {
      this.error = "Email and name are required";
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.newAdminEmail)) {
      this.error = "Please enter a valid email address";
      return;
    }

    const tenantId = this.getActiveTenantId();
    if (!tenantId) {
      this.error = "No active tenant selected";
      return;
    }

    this.adding = true;
    this.error = null;
    this.clearSuccess();

    try {
      const email = this.newAdminEmail.toLowerCase().trim();
      const name = this.newAdminName.trim();

      if (await this.isSuperAdminEmail(email)) {
        this.error =
          "Super admins are managed at the platform level and are not listed here";
        return;
      }

      // Check if admin already exists for this tenant
      const { data: existing } = await this.supabase.client
        .from("tenant_memberships")
        .select("user_email")
        .eq("tenant_id", tenantId)
        .eq("user_email", email)
        .eq("role", "tenant_admin")
        .maybeSingle();

      if (existing) {
        this.error = "This email is already an admin for this tenant";
        return;
      }

      // Insert or promote to tenant admin for this tenant only
      const { error: upsertError } = await this.supabase.client
        .from("tenant_memberships")
        .upsert(
          {
            tenant_id: tenantId,
            user_email: email,
            name,
            role: "tenant_admin",
            is_active: true,
            receive_admin_push: true,
          },
          {
            onConflict: "tenant_id,user_email",
          }
        );

      if (upsertError) throw upsertError;

      // Send invitation email in background (don't await)
      this.sendInvitationEmail(email, name).catch((emailErr) => {
        console.warn("Error sending invitation email:", emailErr);
      });

      this.showSuccessMessage(
        `Admin added successfully! Invitation email sent to ${email}`
      );
      this.toast.success(`Admin ${name} added successfully`);
      this.newAdminEmail = "";
      this.newAdminName = "";
      this.showAddForm = false;

      // Reload admins list
      this.loadAdmins();
      this.onSave.emit();
    } catch (err: unknown) {
      console.error("Error adding admin:", err);
      this.error = "Failed to add admin user";
    } finally {
      this.adding = false;
    }
  }

  async sendInvitationEmail(email: string, name: string) {
    try {
      // Fetch admin_invitation template from database
      const tenantId = this.tenantContext.getActiveTenant()?.id ?? null;
      const template = await this.emailService.getTemplate(
        "admin_invitation",
        tenantId
      );

      const appUrl = this.emailService.getEmailBaseUrl();
      const adminLink = `${appUrl}/admin`;

      let subject: string;
      let htmlBody: string;
      let textBody: string;

      if (template) {
        // Use database template with variable substitution
        const variables = {
          name: name,
          email: email,
          adminLink: adminLink,
        };

        subject = this.emailService.applyTemplateVariables(
          template.subject,
          variables
        );
        htmlBody = this.emailService.applyTemplateVariables(
          template.html_body,
          variables
        );
        textBody = this.emailService.applyTemplateVariables(
          template.text_body,
          variables
        );
      } else {
        // Fallback to hardcoded template if database template not found
        console.warn(
          "admin_invitation template not found in database, using fallback"
        );
        subject = "Admin Access Granted - Prayer App";
        htmlBody = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
                .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0;">🙏 Prayer App</h1>
                  <p style="margin: 10px 0 0 0;">Admin Access Granted</p>
                </div>
                <div class="content">
                  <h2>Welcome, ${name}!</h2>
                  <p>You've been granted admin access to the Prayer App. As an admin, you can:</p>
                  <ul>
                    <li>Review and approve prayer requests</li>
                    <li>Manage prayer updates and deletions</li>
                    <li>Configure email settings and subscribers</li>
                    <li>Manage prayer prompts and types</li>
                    <li>Access the full admin portal</li>
                  </ul>
                  
                  <p>To sign in to the admin portal:</p>
                  <ol>
                    <li>Go to the admin login page link at the bottom of the main site</li>
                    <li>Enter your email address: <strong>${email}</strong></li>
                    <li>Click "Send Magic Link"</li>
                    <li>Check your email for the secure sign-in link</li>
                  </ol>
                  
                  <div style="text-align: center;">
                    <a href="${adminLink}" class="button">Go to Admin Portal</a>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    <strong>Note:</strong> Prayer App uses passwordless authentication. You'll receive a magic link via email each time you sign in.
                  </p>
                </div>
                <div class="footer">
                  <p>Prayer App Admin Portal</p>
                </div>
              </div>
            </body>
          </html>
        `;
        textBody = `
Welcome to Prayer App Admin Portal!

Hi ${name},

You've been granted admin access to the Prayer App.

To sign in:
1. Go to ${adminLink}
2. Enter your email: ${email}
3. Click "Send Magic Link"
4. Check your email for the sign-in link

Prayer App uses passwordless authentication for security.

---
Prayer App Admin Portal
        `;
      }

      // Send email using the email service
      await this.emailService.sendEmail({
        to: email,
        subject,
        htmlBody,
        textBody,
      });
    } catch (error) {
      console.error("Error sending invitation email:", error);
      throw error;
    }
  }

  async deleteAdmin(email: string) {
    // Don't allow deleting the last admin
    if (this.admins.length === 1) {
      this.error = "Cannot delete the last admin user";
      return;
    }

    this.error = null;
    this.clearSuccess();

    const tenantId = this.getActiveTenantId();
    if (!tenantId) {
      this.error = "No active tenant selected";
      return;
    }

    try {
      const { error: deleteError } = await this.supabase.client
        .from("tenant_memberships")
        .update({ role: "member" })
        .eq("tenant_id", tenantId)
        .eq("user_email", email);

      if (deleteError) throw deleteError;

      this.showSuccessMessage(`Admin access removed for ${email}`);
      this.toast.success(`Admin access removed for ${email}`);
      await this.loadAdmins();
      this.onSave.emit();
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : String(err);
      console.error("Error deleting admin:", err);
      this.error = "Failed to remove admin access";
    }
  }

  handleToggleReceiveEmails(
    email: string,
    name: string,
    currentStatus: boolean
  ) {
    if (!currentStatus) {
      this.toggleReceiveEmails(email, currentStatus);
      return;
    }
    this.confirmationTitle = "Disable email notifications?";
    this.confirmationMessage = `Stop sending admin email notifications to ${name}?`;
    this.confirmationDetails =
      "They will no longer receive admin alerts and updates by email. You can turn this back on anytime.";
    this.confirmationConfirmText = "Disable";
    this.confirmationAction = () =>
      this.toggleReceiveEmails(email, currentStatus);
    this.showConfirmationDialog = true;
    this.cdr.markForCheck();
  }

  handleToggleReceivePush(email: string, name: string, currentStatus: boolean) {
    if (!currentStatus) {
      this.toggleReceivePush(email, currentStatus);
      return;
    }
    this.confirmationTitle = "Disable push notifications?";
    this.confirmationMessage = `Stop sending admin push notifications to ${name}?`;
    this.confirmationDetails =
      "They will no longer receive admin alerts on their device. You can turn this back on anytime.";
    this.confirmationConfirmText = "Disable";
    this.confirmationAction = () =>
      this.toggleReceivePush(email, currentStatus);
    this.showConfirmationDialog = true;
    this.cdr.markForCheck();
  }

  async onConfirmDialog() {
    const action = this.confirmationAction;
    this.showConfirmationDialog = false;
    this.confirmationAction = null;
    this.confirmationIsDangerous = false;
    this.cdr.markForCheck();
    if (action) await action();
  }

  onCancelDialog() {
    this.showConfirmationDialog = false;
    this.confirmationAction = null;
    this.confirmationIsDangerous = false;
    this.cdr.markForCheck();
  }

  handleDeleteAdmin(email: string, name: string) {
    if (this.admins.length === 1) return;
    this.confirmationTitle = "Remove admin access?";
    this.confirmationMessage = `Remove admin access for ${name}?`;
    this.confirmationDetails =
      "They will lose all administrative privileges and will no longer be able to sign in to the admin portal. They can be added as an admin again later.";
    this.confirmationConfirmText = "Remove access";
    this.confirmationIsDangerous = true;
    this.confirmationAction = () => this.deleteAdmin(email);
    this.showConfirmationDialog = true;
    this.cdr.markForCheck();
  }

  async toggleReceiveEmails(email: string, currentStatus: boolean) {
    this.error = null;
    this.clearSuccess();

    const tenantId = this.getActiveTenantId();
    if (!tenantId) {
      this.error = "No active tenant selected";
      return;
    }

    try {
      const { error: updateError } = await this.supabase.client
        .from("tenant_memberships")
        .update({ receive_admin_emails: !currentStatus })
        .eq("tenant_id", tenantId)
        .eq("user_email", email);

      if (updateError) throw updateError;

      this.toast.success(
        `Email notifications ${
          !currentStatus ? "enabled" : "disabled"
        } for ${email}`
      );
      this.loadAdmins();
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : String(err);
      console.error("Error toggling email preference:", err);
      this.error = "Failed to update email preference";
    }
    this.cdr.markForCheck();
  }

  async toggleReceivePush(email: string, currentStatus: boolean) {
    this.error = null;
    this.clearSuccess();

    const tenantId = this.getActiveTenantId();
    if (!tenantId) {
      this.error = "No active tenant selected";
      return;
    }

    try {
      const { error: updateError } = await this.supabase.client
        .from("tenant_memberships")
        .update({ receive_admin_push: !currentStatus })
        .eq("tenant_id", tenantId)
        .eq("user_email", email);

      if (updateError) throw updateError;

      this.toast.success(
        `Push notifications ${
          !currentStatus ? "enabled" : "disabled"
        } for ${email}`
      );
      this.loadAdmins();
    } catch (err: unknown) {
      console.error("Error toggling push preference:", err);
      this.error = "Failed to update push preference";
    }
    this.cdr.markForCheck();
  }

  cancelAddForm() {
    this.showAddForm = false;
    this.newAdminEmail = "";
    this.newAdminName = "";
    this.error = null;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getReceivingEmailsCount(): number {
    return this.admins.filter((a) => a.receive_admin_emails).length;
  }

  getReceivingPushCount(): number {
    return this.admins.filter((a) => a.receive_admin_push).length;
  }
}
