import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TenantContextService } from '../../services/tenant-context.service';
import { TenantManagementService } from '../../services/tenant-management.service';
import { TenantPermissionService } from '../../services/tenant-permission.service';
import { ToastService } from '../../services/toast.service';
import type { PlanTier, PlanStatus, TenantMembership } from '../../types/tenant';

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
      }
    </div>
  `
})
export class TenantManagementComponent implements OnInit {
  activeTenantId: string | null = null;
  activeTenantName = '';
  planTier: PlanTier = 'groups';
  planStatus: PlanStatus = 'active';
  inviteEmail = '';
  lastInviteToken = '';
  memberships: TenantMembership[] = [];
  isSuperAdmin = false;
  superAdminEmail = '';

  constructor(
    private tenantContext: TenantContextService,
    private tenantManagement: TenantManagementService,
    private tenantPermissions: TenantPermissionService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.hydrateFromContext();
    this.tenantContext.activeTenant$.subscribe(() => this.hydrateFromContext());
    this.tenantContext.isSuperAdmin$.subscribe((isSuperAdmin) => {
      this.isSuperAdmin = isSuperAdmin;
    });
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

  private async hydrateFromContext(): Promise<void> {
    const activeTenant = this.tenantContext.getActiveTenant();
    this.activeTenantId = activeTenant?.id || null;
    this.activeTenantName = activeTenant?.name || 'Personal-only';
    this.planTier = activeTenant?.plan_tier || 'groups';
    this.planStatus = activeTenant?.plan_status || 'active';
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
