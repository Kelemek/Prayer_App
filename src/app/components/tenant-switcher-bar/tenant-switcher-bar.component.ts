import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import type { Tenant } from '../../types/tenant';

@Component({
  selector: 'app-tenant-switcher-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <div
        class="sticky top-0 z-[60] border-b px-4 py-2"
        [class]="
          impersonationBar
            ? 'border-amber-300 bg-amber-100/95 dark:border-amber-700 dark:bg-amber-900/90'
            : 'border-gray-200 bg-white/95 backdrop-blur-md dark:border-gray-700 dark:bg-gray-800/95'
        "
      >
        <div
          class="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 sm:justify-center"
        >
          <span
            class="text-xs font-medium shrink-0"
            [class]="
              impersonationBar
                ? 'text-amber-900 dark:text-amber-100'
                : 'text-gray-600 dark:text-gray-300'
            "
          >
            Viewing organization:
          </span>

          <div class="relative min-w-0 flex-1 sm:flex-none sm:min-w-[12rem]">
            <div
              class="overflow-hidden rounded-lg border-2 transition-all"
              [ngClass]="
                impersonationBar
                  ? {
                      'border-amber-500 ring-1 ring-amber-500/40 dark:border-amber-500':
                        showTenantDropdown,
                      'border-amber-400 dark:border-amber-600': !showTenantDropdown,
                      'bg-white/90 dark:bg-amber-950/50': true,
                    }
                  : {
                      'border-blue-500 ring-1 ring-blue-500/30 dark:border-blue-400':
                        showTenantDropdown,
                      'border-gray-300 dark:border-gray-600': !showTenantDropdown,
                      'bg-white dark:bg-gray-800': true,
                    }
              "
            >
              <button
                type="button"
                id="tenant-switcher-bar-trigger"
                (click)="toggleTenantDropdown()"
                [attr.aria-expanded]="showTenantDropdown"
                aria-haspopup="listbox"
                aria-label="Switch organization"
                title="Switch organization"
                class="flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 px-2 py-1.5 text-left transition-all"
              >
                <span
                  class="truncate text-xs font-medium"
                  [class]="
                    impersonationBar
                      ? 'text-amber-950 dark:text-amber-50'
                      : 'text-gray-700 dark:text-gray-200'
                  "
                >
                  {{ activeTenantName }}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="shrink-0 transition-transform"
                  [class]="
                    impersonationBar
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-gray-500 dark:text-gray-400'
                  "
                  [class.rotate-180]="showTenantDropdown"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>

            @if (showTenantDropdown) {
              <div
                class="fixed inset-0 z-[61]"
                (click)="closeTenantDropdown()"
              ></div>
              <div
                role="listbox"
                aria-label="Organizations"
                class="absolute left-0 right-0 z-[62] mt-1 max-h-60 overflow-y-auto rounded-lg border bg-white py-1 shadow-lg dark:bg-gray-800"
                [class]="
                  impersonationBar
                    ? 'border-amber-300 dark:border-amber-700'
                    : 'border-gray-200 dark:border-gray-600'
                "
              >
                @for (tenant of tenantSwitchOptions; track tenant.id) {
                  <button
                    type="button"
                    role="option"
                    [attr.aria-selected]="tenant.id === activeTenantId"
                    (click)="selectTenant(tenant.id)"
                    class="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-xs text-gray-700 transition-colors dark:text-gray-200"
                    [ngClass]="
                      impersonationBar
                        ? {
                            'hover:bg-amber-50 dark:hover:bg-amber-900/30':
                              tenant.id !== activeTenantId,
                            'bg-amber-100 dark:bg-amber-900/40':
                              tenant.id === activeTenantId,
                          }
                        : {
                            'hover:bg-gray-50 dark:hover:bg-gray-700/60':
                              tenant.id !== activeTenantId,
                            'bg-blue-50 dark:bg-blue-900/30':
                              tenant.id === activeTenantId,
                          }
                    "
                    [title]="'Switch to ' + tenant.name"
                  >
                    <span class="truncate">{{ tenant.name }}</span>
                    @if (tenant.id === activeTenantId) {
                      <span
                        class="ml-2 shrink-0"
                        [class]="
                          impersonationBar
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-blue-600 dark:text-blue-400'
                        "
                        >✓</span
                      >
                    }
                  </button>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class TenantSwitcherBarComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  tenantContextLoading = true;
  showTenantDropdown = false;

  constructor(
    private tenantContextService: TenantContextService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.tenantContextService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.tenantContextLoading = loading;
        this.cdr.markForCheck();
      });

    this.tenantContextService.activeTenant$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());

    this.tenantContextService.availableTenants$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());

    this.tenantContextService.memberships$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());

    this.tenantContextService.isSuperAdmin$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showTenantDropdown) {
      this.closeTenantDropdown();
    }
  }

  get impersonationBar(): boolean {
    return this.tenantContextService.getIsImpersonatingTenant();
  }

  get visible(): boolean {
    return (
      !this.tenantContextLoading &&
      !!this.activeTenantId &&
      this.tenantSwitchOptions.length > 1
    );
  }

  get activeTenantId(): string | null {
    return this.tenantContextService.getActiveTenant()?.id ?? null;
  }

  get activeTenantName(): string {
    return this.tenantContextService.getActiveTenant()?.name ?? 'Organization';
  }

  get tenantSwitchOptions(): Tenant[] {
    const options = this.tenantContextService.getTenantSwitcherOptions();
    const unique = new Map(options.map((tenant) => [tenant.id, tenant]));
    const activeTenant = this.tenantContextService.getActiveTenant();
    if (activeTenant?.id && !unique.has(activeTenant.id)) {
      unique.set(activeTenant.id, activeTenant);
    }

    return Array.from(unique.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  toggleTenantDropdown(): void {
    this.showTenantDropdown = !this.showTenantDropdown;
    this.cdr.markForCheck();
  }

  closeTenantDropdown(): void {
    if (!this.showTenantDropdown) {
      return;
    }
    this.showTenantDropdown = false;
    this.cdr.markForCheck();
  }

  async selectTenant(tenantId: string): Promise<void> {
    this.closeTenantDropdown();
    await this.onTenantSelect(tenantId);
  }

  async onTenantSelect(tenantId: string): Promise<void> {
    if (!tenantId || tenantId === this.activeTenantId) {
      return;
    }

    const changed = await this.tenantContextService.switchTenant(tenantId);
    if (!changed) {
      this.toastService.error('Unable to switch organization');
      return;
    }

    this.cdr.markForCheck();
  }
}
