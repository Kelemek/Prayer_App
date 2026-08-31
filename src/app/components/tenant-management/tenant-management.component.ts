import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";
import { TenantContextService } from "../../services/tenant-context.service";
import { TenantManagementService } from "../../services/tenant-management.service";
import { TenantPermissionService } from "../../services/tenant-permission.service";
import { ToastService } from "../../services/toast.service";
import type {
  PlanTier,
  PlanStatus,
  Tenant,
  TenantMembership,
} from "../../types/tenant";

@Component({
  selector: "app-tenant-management",
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700"
    >
      <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
        Tenant Management
      </h3>

      @if (contextLoading) {
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Loading organizations…
      </p>
      } @else {
      <div
        class="mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40"
      >
        <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
          Create organization
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label
              class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
              >Name</label
            >
            <input
              [(ngModel)]="newTenantName"
              type="text"
              placeholder="My church"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
              >Slug</label
            >
            <input
              [(ngModel)]="newTenantSlug"
              type="text"
              placeholder="my-church"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="md:col-span-2">
            <label
              class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
              >Plan tier</label
            >
            <select
              [(ngModel)]="newTenantPlanTier"
              class="w-full md:max-w-xs px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="free">free</option>
              <option value="churches">churches (Church)</option>
            </select>
          </div>
        </div>
        <button
          type="button"
          (click)="createNewTenant()"
          [disabled]="
            isCreatingTenant || !newTenantName.trim() || !newTenantSlug.trim()
          "
          class="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {{ isCreatingTenant ? "Creating…" : "Create organization" }}
        </button>
      </div>

      <div class="mb-6">
        <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
          Your organizations
        </h4>
        @if (availableTenants.length === 0) {
        <p class="text-sm text-gray-500 dark:text-gray-400">
          No organizations yet. Create one above.
        </p>
        } @else { @if (availableTenants.length > 3) {
        <input
          [(ngModel)]="tenantSearch"
          type="text"
          placeholder="Search by name or slug"
          class="w-full mb-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        }
        <ul
          class="divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden"
        >
          @for (tenant of filteredTenants; track tenant.id) {
          <li
            class="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-white dark:bg-gray-900 text-sm"
          >
            <div>
              <div class="font-medium text-gray-800 dark:text-gray-100">
                {{ tenant.name }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                {{ tenant.slug }} · {{ tenant.plan_tier }} ·
                {{ tenant.plan_status }}
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              @if (tenant.id === activeTenantId) {
              <span
                class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
              >
                Current
              </span>
              @if (isImpersonatingTenant) {
              <span
                class="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
              >
                Impersonating
              </span>
              } } @else {
              <button
                type="button"
                (click)="setActiveTenant(tenant.id)"
                [disabled]="isSwitchingTenant"
                class="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {{ isSwitchingTenant ? "…" : "Set as active" }}
              </button>
              }
            </div>
          </li>
          }
        </ul>
        }
      </div>

      @if (!activeTenantId) {
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        @if (availableTenants.length > 0) { Select an organization above to
        manage plan, invites, and members. } @else { No active organization.
        Create one to use shared and admin features for that organization. }
      </p>
      } @else {
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label
            class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
            >Active Tenant</label
          >
          <div class="text-sm text-gray-800 dark:text-gray-100">
            {{ activeTenantName }}
          </div>
        </div>
        <div>
          <label
            class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
            >Plan Tier</label
          >
          <div class="flex gap-2">
            <select
              [(ngModel)]="planTier"
              class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="free">free</option>
              <option value="groups">groups</option>
              <option value="churches">churches</option>
            </select>
            <select
              [(ngModel)]="planStatus"
              class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">active</option>
              <option value="trialing">trialing</option>
              <option value="past_due">past_due</option>
              <option value="canceled">canceled</option>
              <option value="incomplete">incomplete</option>
            </select>
            <button
              (click)="updatePlan()"
              class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <div class="mb-4">
        <label
          class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
          >Invite Member</label
        >
        <div class="flex gap-2">
          <input
            [(ngModel)]="inviteEmail"
            type="email"
            placeholder="member@example.com"
            class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            (click)="createInvite()"
            class="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
          >
            Create Invite
          </button>
        </div>
        @if (lastInviteToken) {
        <p class="mt-2 text-xs text-gray-600 dark:text-gray-300 break-all">
          Invite Token: {{ lastInviteToken }}
        </p>
        }
      </div>

      <div>
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          Members
        </h4>
        @if (memberships.length === 0) {
        <p class="text-xs text-gray-500 dark:text-gray-400">
          No memberships found.
        </p>
        } @else {
        <div class="space-y-1">
          @for (membership of memberships; track membership.tenant_id + ':' +
          membership.user_email) {
          <div class="text-xs text-gray-700 dark:text-gray-300">
            {{ membership.user_email }} - {{ membership.role }}
          </div>
          }
        </div>
        }
      </div>
      } } @if (!contextLoading && isSuperAdmin) {
      <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Super Admin Controls
          </h4>
          <button
            type="button"
            (click)="loadSuperAdmins()"
            [disabled]="superAdminsLoading"
            class="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {{ superAdminsLoading ? "Loading…" : "Refresh list" }}
          </button>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Super admins can access all tenants and grant or revoke this role
          below.
        </p>

        @if (superAdminsLoading && superAdmins.length === 0) {
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Loading super admins…
        </p>
        } @else if (superAdmins.length === 0) {
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          No super admin rows returned.
        </p>
        } @else { @if (superAdmins.length > 5) {
        <input
          [(ngModel)]="superAdminSearch"
          type="text"
          placeholder="Filter by email"
          class="w-full mb-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        }
        <div
          class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600 mb-4"
        >
          <table class="w-full text-sm text-left">
            <thead
              class="bg-gray-50 dark:bg-gray-900/80 text-gray-600 dark:text-gray-300"
            >
              <tr>
                <th class="px-3 py-2 font-medium">Email</th>
                <th class="px-3 py-2 font-medium w-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody
              class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900"
            >
              @for (row of filteredSuperAdmins; track row.user_email) {
              <tr class="text-gray-800 dark:text-gray-100">
                <td class="px-3 py-2.5">
                  <span class="break-all">{{ row.user_email }}</span>
                  @if (actorEmail && row.user_email.toLowerCase() ===
                  actorEmail) {
                  <span
                    class="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                    >You</span
                  >
                  }
                </td>
                <td class="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    (click)="revokeSuperAdminRow(row.user_email)"
                    [disabled]="revokingSuperAdminEmail === row.user_email"
                    class="text-xs px-2.5 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {{
                      revokingSuperAdminEmail === row.user_email
                        ? "…"
                        : "Revoke"
                    }}
                  </button>
                </td>
              </tr>
              }
            </tbody>
          </table>
        </div>
        }

        <div class="mb-2">
          <label
            class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
            >Grant super admin</label
          >
          <div class="flex flex-wrap gap-2">
            <input
              [(ngModel)]="superAdminEmail"
              type="email"
              placeholder="admin@example.com"
              class="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              (click)="assignSuperAdmin()"
              [disabled]="grantingSuperAdmin || !superAdminEmail.trim()"
              class="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {{ grantingSuperAdmin ? "Granting…" : "Grant" }}
            </button>
          </div>
        </div>

        <div>
          <label
            class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
            >Revoke by email</label
          >
          <div class="flex flex-wrap gap-2">
            <input
              [(ngModel)]="superAdminRevokeEmail"
              type="email"
              placeholder="user@example.com"
              class="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              (click)="removeSuperAdminByForm()"
              [disabled]="
                revokingSuperAdminByForm || !superAdminRevokeEmail.trim()
              "
              class="px-3 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-60"
            >
              {{ revokingSuperAdminByForm ? "Revoking…" : "Revoke" }}
            </button>
          </div>
        </div>
      </div>
      }
    </div>
  `,
})
export class TenantManagementComponent implements OnInit, OnDestroy {
  contextLoading = true;
  activeTenantId: string | null = null;
  activeTenantName = "";
  planTier: PlanTier = "groups";
  planStatus: PlanStatus = "active";
  inviteEmail = "";
  lastInviteToken = "";
  memberships: TenantMembership[] = [];
  isSuperAdmin = false;
  superAdminEmail = "";
  superAdminRevokeEmail = "";
  superAdmins: { user_email: string }[] = [];
  superAdminsLoading = false;
  superAdminSearch = "";
  actorEmail: string | null = null;
  revokingSuperAdminEmail: string | null = null;
  grantingSuperAdmin = false;
  revokingSuperAdminByForm = false;
  availableTenants: Tenant[] = [];
  tenantSearch = "";
  isSwitchingTenant = false;
  isImpersonatingTenant = false;
  newTenantName = "";
  newTenantSlug = "";
  newTenantPlanTier: PlanTier = "churches";
  isCreatingTenant = false;
  private destroy$ = new Subject<void>();

  constructor(
    private tenantContext: TenantContextService,
    private tenantManagement: TenantManagementService,
    private tenantPermissions: TenantPermissionService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.hydrateFromContext();
    this.tenantContext.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.contextLoading = loading;
      });
    this.tenantContext.activeTenant$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.hydrateFromContext());
    this.tenantContext.isSuperAdmin$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (isSuperAdmin) => {
        this.isSuperAdmin = isSuperAdmin;
        if (isSuperAdmin) {
          const actor = await this.tenantManagement.getActorEmail();
          this.actorEmail = actor?.toLowerCase().trim() ?? null;
          await this.loadSuperAdmins();
        } else {
          this.superAdmins = [];
          this.actorEmail = null;
        }
      });
    this.tenantContext.availableTenants$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => void this.hydrateFromContext());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async createNewTenant(): Promise<void> {
    const name = this.newTenantName.trim();
    const slug = this.normalizeSlug(this.newTenantSlug);
    if (!name || !slug) {
      this.toast.error("Name and slug are required");
      return;
    }
    this.isCreatingTenant = true;
    try {
      const tenant = await this.tenantManagement.createTenant(
        name,
        slug,
        this.newTenantPlanTier
      );
      const switched = await this.tenantContext.switchTenant(tenant.id);
      if (!switched) {
        this.toast.success("Organization created");
      } else {
        this.toast.success(
          `Organization "${tenant.name}" created and set as active`
        );
      }
      this.newTenantName = "";
      this.newTenantSlug = "";
      this.newTenantPlanTier = "churches";
      await this.hydrateFromContext();
    } catch (error) {
      this.toast.error(
        error instanceof Error ? error.message : "Failed to create organization"
      );
    } finally {
      this.isCreatingTenant = false;
    }
  }

  async setActiveTenant(tenantId: string): Promise<void> {
    if (tenantId === this.activeTenantId) {
      this.toast.success(`Already using ${this.activeTenantName}`);
      return;
    }
    const tenant = this.availableTenants.find((t) => t.id === tenantId);
    const label = tenant?.name || "organization";
    this.isSwitchingTenant = true;
    try {
      const changed = await this.tenantContext.switchTenant(tenantId);
      if (!changed) {
        this.toast.error(
          "Unable to switch organization. Try refreshing the page."
        );
        return;
      }
      await this.hydrateFromContext();
      this.toast.success(`Active organization is now ${label}`);
    } finally {
      this.isSwitchingTenant = false;
    }
  }

  async createInvite(): Promise<void> {
    if (!this.activeTenantId || !this.inviteEmail.trim()) return;
    try {
      this.lastInviteToken = await this.tenantManagement.createInvite(
        this.activeTenantId,
        this.inviteEmail
      );
      this.toast.success("Invite created");
      this.inviteEmail = "";
    } catch (error) {
      this.toast.error(
        error instanceof Error ? error.message : "Failed to create invite"
      );
    }
  }

  async updatePlan(): Promise<void> {
    if (!this.activeTenantId) return;
    if (!this.tenantPermissions.canManageTenant()) {
      this.toast.error("You do not have permission to update plan settings");
      return;
    }
    try {
      await this.tenantManagement.setTenantPlan(
        this.activeTenantId,
        this.planTier,
        this.planStatus
      );
      this.toast.success("Tenant plan updated");
      this.hydrateFromContext();
    } catch (error) {
      this.toast.error(
        error instanceof Error ? error.message : "Failed to update plan"
      );
    }
  }

  async loadSuperAdmins(): Promise<void> {
    if (!this.isSuperAdmin) return;
    this.superAdminsLoading = true;
    try {
      this.superAdmins = await this.tenantManagement.listSuperAdmins();
    } catch (error) {
      this.superAdmins = [];
      this.toast.error(
        error instanceof Error ? error.message : "Failed to load super admins"
      );
    } finally {
      this.superAdminsLoading = false;
    }
  }

  async assignSuperAdmin(): Promise<void> {
    if (!this.superAdminEmail.trim()) return;
    this.grantingSuperAdmin = true;
    try {
      await this.tenantManagement.assignSuperAdmin(this.superAdminEmail);
      this.toast.success("Super admin granted");
      this.superAdminEmail = "";
      await this.loadSuperAdmins();
    } catch (error) {
      this.toast.error(
        error instanceof Error ? error.message : "Failed to grant super admin"
      );
    } finally {
      this.grantingSuperAdmin = false;
    }
  }

  async removeSuperAdminByForm(): Promise<void> {
    if (!this.superAdminRevokeEmail.trim()) return;
    await this.revokeSuperAdminEmail(this.superAdminRevokeEmail, () => {
      this.superAdminRevokeEmail = "";
    });
  }

  async revokeSuperAdminRow(email: string): Promise<void> {
    await this.revokeSuperAdminEmail(email);
  }

  private async revokeSuperAdminEmail(
    email: string,
    onSuccess?: () => void
  ): Promise<void> {
    const normalized = email.toLowerCase().trim();
    const isSelf = !!this.actorEmail && normalized === this.actorEmail;
    if (isSelf && this.superAdmins.length <= 1) {
      this.toast.error("You cannot remove the only super admin.");
      return;
    }
    if (!globalThis.confirm(`Revoke super admin from ${normalized}?`)) {
      return;
    }
    const isForm = !!onSuccess;
    if (isForm) {
      this.revokingSuperAdminByForm = true;
    } else {
      this.revokingSuperAdminEmail = normalized;
    }
    try {
      await this.tenantManagement.removeSuperAdmin(normalized);
      this.toast.success("Super admin revoked");
      onSuccess?.();
      await this.loadSuperAdmins();
    } catch (error) {
      this.toast.error(
        error instanceof Error ? error.message : "Failed to revoke super admin"
      );
    } finally {
      if (isForm) {
        this.revokingSuperAdminByForm = false;
      } else {
        this.revokingSuperAdminEmail = null;
      }
    }
  }

  get filteredSuperAdmins(): { user_email: string }[] {
    const q = this.superAdminSearch.trim().toLowerCase();
    if (!q) return this.superAdmins;
    return this.superAdmins.filter((row) =>
      row.user_email.toLowerCase().includes(q)
    );
  }

  get filteredTenants(): Tenant[] {
    const query = this.tenantSearch.trim().toLowerCase();
    if (!query) {
      return this.availableTenants;
    }
    return this.availableTenants.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(query) ||
        tenant.slug.toLowerCase().includes(query)
    );
  }

  private normalizeSlug(raw: string): string {
    return raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  private async hydrateFromContext(): Promise<void> {
    this.availableTenants = this.tenantContext.getAvailableTenants();
    const activeTenant = this.tenantContext.getActiveTenant();
    this.activeTenantId = activeTenant?.id || null;
    this.activeTenantName = activeTenant?.name || "Personal-only";
    this.planTier = activeTenant?.plan_tier || "groups";
    this.planStatus = activeTenant?.plan_status || "active";
    this.isImpersonatingTenant = this.tenantContext.getIsImpersonatingTenant();
    if (this.activeTenantId) {
      try {
        this.memberships =
          await this.tenantManagement.getMembershipsForActiveTenant();
      } catch {
        this.memberships = [];
      }
    } else {
      this.memberships = [];
    }
  }
}
