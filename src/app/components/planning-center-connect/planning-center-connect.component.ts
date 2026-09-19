import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import {
  clearPlanningCenterCredentials,
  fetchPlanningCenterCredentialsStatus,
  savePlanningCenterCredentials,
  setPlanningCenterEnabled,
  testPlanningCenterCredentials,
  type PlanningCenterCredentialsStatus,
} from '../../lib/planning-center';
import { AdminCollapsibleSectionComponent } from '../admin-collapsible-section/admin-collapsible-section.component';

@Component({
  selector: 'app-planning-center-connect',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, AdminCollapsibleSectionComponent],
  template: `
    <app-admin-collapsible-section
      title="Planning Center"
      triggerId="planning-center-connect-trigger"
      panelId="planning-center-connect-panel"
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
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>

      @if (!activeTenantId) {
        <p class="text-sm text-amber-800 dark:text-amber-200">
          Select a church organization to configure Planning Center.
        </p>
      } @else if (loading) {
        <p class="text-sm text-gray-600 dark:text-gray-400">Loading…</p>
      } @else {
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Connect your church&apos;s Planning Center OAuth application (App ID and Secret from
          Planning Center → Developers). Credentials are stored securely server-side; they are never
          shown again after save.
        </p>

        <label class="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            class="rounded border-gray-300"
            [checked]="status?.enabled ?? false"
            [disabled]="!status?.configured || busy"
            (change)="onToggleEnabled($event)"
          />
          <span class="text-sm text-gray-800 dark:text-gray-200">Enable Planning Center for this church</span>
        </label>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">App ID</label>
            <input
              type="text"
              [(ngModel)]="appId"
              name="pcoAppId"
              [placeholder]="status?.configured ? '••••' + (status?.app_id_last4 ?? '') : 'Application ID'"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              autocomplete="off"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Secret</label>
            <input
              type="password"
              [(ngModel)]="secret"
              name="pcoSecret"
              placeholder="Write-only — paste to save or rotate"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              autocomplete="new-password"
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm cursor-pointer disabled:opacity-50"
            [disabled]="busy || !appId.trim() || !secret.trim()"
            (click)="onSave()"
          >
            {{ busy ? 'Saving…' : 'Save credentials' }}
          </button>
          <button
            type="button"
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm cursor-pointer disabled:opacity-50"
            [disabled]="busy"
            (click)="onTest()"
          >
            Test connection
          </button>
          @if (status?.configured) {
            <button
              type="button"
              class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm cursor-pointer disabled:opacity-50"
              [disabled]="busy"
              (click)="onDisconnect()"
            >
              Disconnect
            </button>
          }
        </div>
      }
    </app-admin-collapsible-section>
  `,
})
export class PlanningCenterConnectComponent implements OnChanges {
  @Input() activeTenantId: string | null = null;
  @Output() credentialsConfiguredChange = new EventEmitter<boolean>();

  sectionExpanded = false;
  loading = false;
  busy = false;
  status: PlanningCenterCredentialsStatus | null = null;
  appId = '';
  secret = '';

  constructor(
    private readonly supabase: SupabaseService,
    private readonly tenantContext: TenantContextService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeTenantId']) {
      void this.loadStatus();
    }
  }

  onExpandedChange(expanded: boolean): void {
    this.sectionExpanded = expanded;
    if (expanded) {
      void this.loadStatus();
    }
    this.cdr.markForCheck();
  }

  async loadStatus(): Promise<void> {
    const tenantId = this.activeTenantId ?? this.tenantContext.getActiveTenant()?.id ?? null;
    if (!tenantId) {
      this.status = null;
      this.credentialsConfiguredChange.emit(false);
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.cdr.markForCheck();
    const { status, error } = await fetchPlanningCenterCredentialsStatus(
      this.supabase.client,
      tenantId
    );
    this.loading = false;
    if (error) {
      this.toast.error(error);
      this.credentialsConfiguredChange.emit(false);
    } else {
      this.status = status;
      this.credentialsConfiguredChange.emit(Boolean(status?.configured));
    }
    this.cdr.markForCheck();
  }

  async onSave(): Promise<void> {
    const tenantId = this.activeTenantId ?? this.tenantContext.getActiveTenant()?.id;
    if (!tenantId) {
      return;
    }
    this.busy = true;
    this.cdr.markForCheck();
    const { error } = await savePlanningCenterCredentials(
      this.supabase.client,
      tenantId,
      this.appId.trim(),
      this.secret.trim()
    );
    this.busy = false;
    if (error) {
      this.toast.error(error);
    } else {
      this.secret = '';
      this.appId = '';
      this.toast.success('Planning Center credentials saved');
      await this.loadStatus();
    }
    this.cdr.markForCheck();
  }

  async onTest(): Promise<void> {
    const tenantId = this.activeTenantId ?? this.tenantContext.getActiveTenant()?.id;
    if (!tenantId) {
      return;
    }
    this.busy = true;
    this.cdr.markForCheck();
    const useForm = this.appId.trim() && this.secret.trim();
    const { ok, error } = await testPlanningCenterCredentials(
      this.supabase.client,
      tenantId,
      useForm ? this.appId.trim() : undefined,
      useForm ? this.secret.trim() : undefined
    );
    this.busy = false;
    if (!ok) {
      this.toast.error(error ?? 'Connection failed');
    } else {
      this.toast.success('Planning Center connection succeeded');
    }
    this.cdr.markForCheck();
  }

  async onToggleEnabled(event: Event): Promise<void> {
    const tenantId = this.activeTenantId ?? this.tenantContext.getActiveTenant()?.id;
    if (!tenantId) {
      return;
    }
    const checked = (event.target as HTMLInputElement).checked;
    this.busy = true;
    this.cdr.markForCheck();
    const { error } = await setPlanningCenterEnabled(this.supabase.client, tenantId, checked);
    this.busy = false;
    if (error) {
      this.toast.error(error);
    } else {
      await this.loadStatus();
    }
    this.cdr.markForCheck();
  }

  async onDisconnect(): Promise<void> {
    const tenantId = this.activeTenantId ?? this.tenantContext.getActiveTenant()?.id;
    if (!tenantId) {
      return;
    }
    this.busy = true;
    this.cdr.markForCheck();
    const { error } = await clearPlanningCenterCredentials(this.supabase.client, tenantId);
    this.busy = false;
    if (error) {
      this.toast.error(error);
    } else {
      this.secret = '';
      this.appId = '';
      this.toast.success('Planning Center disconnected');
      await this.loadStatus();
    }
    this.cdr.markForCheck();
  }
}
