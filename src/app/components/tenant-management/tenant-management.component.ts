import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TenantContextService } from '../../services/tenant-context.service';
import { TenantManagementService } from '../../services/tenant-management.service';
import { TenantPermissionService } from '../../services/tenant-permission.service';
import { ToastService } from '../../services/toast.service';
import type { PlanTier, PlanStatus, Tenant, TenantMembership } from '../../types/tenant';

@Component({
  selector: 'app-tenant-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Tenant Management</h3>

      @if (!activeTenantId) {
        <p class="text-sm text-gray-500 dark:text-gray-400">No active tenant selected. Personal-only users will not see shared/admin features.</p>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Active Tenant</label>
            <div class="text-sm text-gray-800 dark:text-gray-100">{{ activeTenantName }}</div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Plan Tier</label>
            <div class="flex gap-2">
              <select [(ngModel)]="planTier" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm">
                <option value="free">free</option>
                <option value="groups">groups</option>
                <option value="churches">churches</option>
              </select>
              <select [(ngModel)]="planStatus" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm">
                <option value="active">active</option>
                <option value="trialing">trialing</option>
                <option value="past_due">past_due</option>
                <option value="canceled">canceled</option>
                <option value="incomplete">incomplete</option>
              </select>
              <button (click)="updatePlan()" class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Invite Member</label>
          <div class="flex gap-2">
            <input [(ngModel)]="inviteEmail" type="email" placeholder="member@example.com" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm" />
            <button (click)="createInvite()" class="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700">Create Invite</button>
          </div>
          @if (lastInviteToken) {
            <p class="mt-2 text-xs text-gray-600 dark:text-gray-300 break-all">Invite Token: {{ lastInviteToken }}</p>
          }
        </div>

        <div>
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Members</h4>
          @if (memberships.length === 0) {
            <p class="text-xs text-gray-500 dark:text-gray-400">No memberships found.</p>
          } @else {
            <div class="space-y-1">
              @for (membership of memberships; track membership.tenant_id + ':' + membership.user_email) {
                <div class="text-xs text-gray-700 dark:text-gray-300">{{ membership.user_email }} - {{ membership.role }}</div>
              }
            </div>
          }
        </div>
      }

      @if (isSuperAdmin) {
        <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Super Admin Controls</h4>
          <div class="flex gap-2">
            <input [(ngModel)]="superAdminEmail" type="email" placeholder="admin@example.com" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm" />
            <button (click)="assignSuperAdmin()" class="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">Grant</button>
            <button (click)="removeSuperAdmin()" class="px-3 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700">Revoke</button>
          </div>
        </div>

        <div class="mt-4 p-4 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-900/20">
          <h4 class="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Tenant View / Impersonation</h4>
          <p class="text-xs text-blue-700 dark:text-blue-200 mb-3">
            Choose a tenant to view and perform actions exactly in that tenant context.
          </p>

          @if (availableTenants.length === 0) {
            <p class="text-xs text-gray-500 dark:text-gray-400">No tenants available.</p>
          } @else {
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-3">
              <input
                [(ngModel)]="tenantSearch"
                type="text"
                placeholder="Search tenants by name or slug"
                class="lg:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              />
              <select
                [(ngModel)]="selectedTenantId"
                class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              >
                @for (tenant of filteredTenants; track tenant.id) {
                  <option [value]="tenant.id">{{ tenant.name }} ({{ tenant.slug }})</option>
                }
              </select>
            </div>

            <div class="flex items-center justify-between gap-2 mb-2">
              <div class="text-xs text-gray-700 dark:text-gray-300">
                Active: <span class="font-semibold">{{ activeTenantName }}</span>
              </div>
              @if (isImpersonatingTenant) {
                <span class="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  Impersonating
                </span>
              }
            </div>

            <button
              (click)="switchTenantView()"
              [disabled]="isSwitchingTenant || !selectedTenantId"
              class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {{ isSwitchingTenant ? 'Switching...' : 'Switch Tenant View' }}
            </button>
          }
        </div>
      }
    </div>
  `
})
export class TenantManagementComponent implements OnInit, OnDestroy {
  activeTenantId: string | null = null;
  activeTenantName = '';
  planTier: PlanTier = 'groups';
  planStatus: PlanStatus = 'active';
  inviteEmail = '';
  lastInviteToken = '';
  memberships: TenantMembership[] = [];
  isSuperAdmin = false;
  superAdminEmail = '';
  availableTenants: Tenant[] = [];
  selectedTenantId = '';
  tenantSearch = '';
  isSwitchingTenant = false;
  isImpersonatingTenant = false;
  private destroy$ = new Subject<void>();

  constructor(
    private tenantContext: TenantContextService,
    private tenantManagement: TenantManagementService,
    private tenantPermissions: TenantPermissionService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.hydrateFromContext();
    this.tenantContext.activeTenant$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.hydrateFromContext());
    this.tenantContext.isSuperAdmin$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isSuperAdmin) => {
        this.isSuperAdmin = isSuperAdmin;
      });
    this.tenantContext.availableTenants$
      .pipe(takeUntil(this.destroy$))
      .subscribe((tenants) => {
        this.availableTenants = tenants;
        if (!this.selectedTenantId && tenants.length > 0) {
          this.selectedTenantId = tenants[0].id;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async createInvite(): Promise<void> {
    if (!this.activeTenantId || !this.inviteEmail.trim()) return;
    try {
      this.lastInviteToken = await this.tenantManagement.createInvite(this.activeTenantId, this.inviteEmail);
      this.toast.success('Invite created');
      this.inviteEmail = '';
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Failed to create invite');
    }
  }

  async updatePlan(): Promise<void> {
    if (!this.activeTenantId) return;
    if (!this.tenantPermissions.canManageTenant()) {
      this.toast.error('You do not have permission to update plan settings');
      return;
    }
    try {
      await this.tenantManagement.setTenantPlan(this.activeTenantId, this.planTier, this.planStatus);
      this.toast.success('Tenant plan updated');
      this.hydrateFromContext();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Failed to update plan');
    }
  }

  async assignSuperAdmin(): Promise<void> {
    if (!this.superAdminEmail.trim()) return;
    try {
      await this.tenantManagement.assignSuperAdmin(this.superAdminEmail);
      this.toast.success('Super admin granted');
      this.superAdminEmail = '';
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Failed to grant super admin');
    }
  }

  async removeSuperAdmin(): Promise<void> {
    if (!this.superAdminEmail.trim()) return;
    try {
      await this.tenantManagement.removeSuperAdmin(this.superAdminEmail);
      this.toast.success('Super admin revoked');
      this.superAdminEmail = '';
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Failed to revoke super admin');
    }
  }

  async switchTenantView(): Promise<void> {
    if (!this.isSuperAdmin || !this.selectedTenantId) {
      return;
    }
    const selectedTenant = this.availableTenants.find((tenant) => tenant.id === this.selectedTenantId);
    const selectedTenantName = selectedTenant?.name || 'selected tenant';
    if (this.selectedTenantId === this.activeTenantId) {
      this.toast.success(`Already viewing ${this.activeTenantName}`);
      return;
    }

    this.isSwitchingTenant = true;
    try {
      const changed = await this.tenantContext.switchTenant(this.selectedTenantId);
      if (!changed) {
        this.toast.error('Unable to switch tenant view');
        return;
      }
      void this.hydrateFromContext();
      this.toast.success(`Now viewing ${selectedTenantName}`);
    } finally {
      this.isSwitchingTenant = false;
    }
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

  private async hydrateFromContext(): Promise<void> {
    const activeTenant = this.tenantContext.getActiveTenant();
    this.activeTenantId = activeTenant?.id || null;
    this.activeTenantName = activeTenant?.name || 'Personal-only';
    this.planTier = activeTenant?.plan_tier || 'groups';
    this.planStatus = activeTenant?.plan_status || 'active';
    this.selectedTenantId = this.activeTenantId || this.selectedTenantId;
    this.isImpersonatingTenant = this.tenantContext.getIsImpersonatingTenant();
    if (this.activeTenantId) {
      try {
        this.memberships = await this.tenantManagement.getMembershipsForActiveTenant();
      } catch {
        this.memberships = [];
      }
    } else {
      this.memberships = [];
    }
  }
}
