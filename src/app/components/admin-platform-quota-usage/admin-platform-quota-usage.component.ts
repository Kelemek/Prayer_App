import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type {
  PlatformQuotaUsageSnapshot,
  PlatformQuotaUsageUserRow,
} from '../../types/platform-quota-usage';
import { PlatformQuotaUsageService } from '../../services/platform-quota-usage.service';
import { AdminCollapsibleSectionComponent } from '../admin-collapsible-section/admin-collapsible-section.component';
import { AdminSectionLoadingComponent } from '../admin-section-loading/admin-section-loading.component';
import { formatReciteCostUsd } from '../../lib/format-recite-cost';
import { isNearQuota } from '../../lib/plan-quota';

@Component({
  selector: 'app-admin-platform-quota-usage',
  standalone: true,
  imports: [CommonModule, AdminCollapsibleSectionComponent, AdminSectionLoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-collapsible-section
      title="Platform usage"
      triggerId="platform-quota-usage-trigger"
      panelId="platform-quota-usage-panel"
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
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>

      @if (loading) {
        <app-admin-section-loading message="Loading platform usage…" />
      } @else if (migrationMissing) {
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Usage snapshot is not available until migration
          <code class="text-xs">20260919120000_platform_quota_usage.sql</code>
          is applied on this project.
        </p>
      } @else if (errorMessage) {
        <p class="text-sm text-red-700 dark:text-red-300">{{ errorMessage }}</p>
      } @else if (snapshot) {
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Read-only snapshot: per-user group caps (owner scope) and month-to-date Recite
          spend. Church tenant group counts are informational only.
        </p>

        <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Users</h4>
        @if (snapshot.users.length === 0) {
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">No usage rows to show.</p>
        } @else {
          <div class="overflow-x-auto mb-6">
            <table class="min-w-full text-xs border border-gray-200 dark:border-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-2 py-2 text-left">Email</th>
                  <th class="px-2 py-2 text-left">Plan</th>
                  <th class="px-2 py-2 text-right">Groups</th>
                  <th class="px-2 py-2 text-right">Largest group</th>
                  <th class="px-2 py-2 text-right">Recite (MTD)</th>
                </tr>
              </thead>
              <tbody>
                @for (row of snapshot.users; track row.email) {
                  <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-2 py-2 break-all">{{ row.email }}</td>
                    <td class="px-2 py-2">
                      {{ row.individual_plan_tier }}
                      @if (row.is_church_member) {
                        <span class="text-gray-500">+ church</span>
                      }
                    </td>
                    <td
                      class="px-2 py-2 text-right"
                      [class.text-amber-700]="isUserGroupsNear(row)"
                    >
                      {{ row.groups_owned }} / {{ row.max_groups_owned }}
                    </td>
                    <td
                      class="px-2 py-2 text-right"
                      [class.text-amber-700]="isUserMembersNear(row)"
                    >
                      {{ row.largest_group_members }} / {{ row.max_members_per_group }}
                    </td>
                    <td class="px-2 py-2 text-right">
                      {{ formatCost(row.recite_estimated_cost_usd) }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
          Church tenants
        </h4>
        @if (snapshot.tenants.length === 0) {
          <p class="text-sm text-gray-500 dark:text-gray-400">No church tenants.</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="min-w-full text-xs border border-gray-200 dark:border-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-2 py-2 text-left">Tenant</th>
                  <th class="px-2 py-2 text-right">Groups created</th>
                  <th class="px-2 py-2 text-right">Recite attempts</th>
                  <th class="px-2 py-2 text-right">Recite (MTD)</th>
                </tr>
              </thead>
              <tbody>
                @for (row of snapshot.tenants; track row.id) {
                  <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-2 py-2">
                      {{ row.name }}
                      <span class="text-gray-500">({{ row.slug }})</span>
                    </td>
                    <td class="px-2 py-2 text-right">{{ row.groups_created_from_tenant }}</td>
                    <td class="px-2 py-2 text-right">{{ row.recite_attempt_count }}</td>
                    <td class="px-2 py-2 text-right">
                      {{ formatCost(row.recite_estimated_cost_usd) }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </app-admin-collapsible-section>
  `,
})
export class AdminPlatformQuotaUsageComponent {
  sectionExpanded = false;
  private sectionInitialLoadDone = false;

  loading = false;
  migrationMissing = false;
  errorMessage = '';
  snapshot: PlatformQuotaUsageSnapshot | null = null;

  readonly formatCost = formatReciteCostUsd;

  constructor(
    private quotaUsage: PlatformQuotaUsageService,
    private cdr: ChangeDetectorRef
  ) {}

  isUserGroupsNear(row: PlatformQuotaUsageUserRow): boolean {
    return isNearQuota(row.groups_owned, row.max_groups_owned);
  }

  isUserMembersNear(row: PlatformQuotaUsageUserRow): boolean {
    return isNearQuota(row.largest_group_members, row.max_members_per_group);
  }

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
    this.migrationMissing = false;
    this.cdr.markForCheck();
    try {
      const data = await this.quotaUsage.loadSnapshot();
      if (data === null) {
        this.migrationMissing = true;
        this.snapshot = null;
      } else {
        this.snapshot = data;
      }
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Failed to load usage.';
      this.snapshot = null;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
