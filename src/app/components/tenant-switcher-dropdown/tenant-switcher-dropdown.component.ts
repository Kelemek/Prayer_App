import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { TenantContextService } from '../../services/tenant-context.service';
import type { Tenant } from '../../types/tenant';

@Component({
  selector: 'app-tenant-switcher-dropdown',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative min-w-0"
      [class.flex-1]="compact"
      [class.sm:flex-none]="compact"
      [class.sm:min-w-[12rem]]="!compact"
    >
      <div
        [ngClass]="{
          'border-blue-500 ring-1 ring-blue-500/30 dark:border-blue-400':
            showDropdown,
          'border-gray-300 dark:border-gray-600': !showDropdown
        }"
        class="overflow-hidden rounded-lg border bg-white dark:bg-gray-800 transition-all"
      >
        <button
          type="button"
          [id]="triggerId"
          (click)="toggleDropdown()"
          [attr.aria-expanded]="showDropdown"
          aria-haspopup="listbox"
          aria-label="Switch organization"
          title="Switch active tenant"
          class="flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 px-2 py-1 text-left transition-all"
          [class.text-[10px]]="compact"
          [class.text-xs]="!compact"
        >
          <span class="truncate font-medium text-gray-700 dark:text-gray-200">
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
            class="shrink-0 text-gray-500 transition-transform dark:text-gray-400"
            [class.rotate-180]="showDropdown"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>

      @if (showDropdown) {
        <div class="fixed inset-0 z-[55]" (click)="closeDropdown()"></div>
        <div
          role="listbox"
          aria-label="Organizations"
          class="absolute left-0 right-0 z-[56] mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
          [class.text-[10px]]="compact"
          [class.text-xs]="!compact"
        >
          @for (tenant of tenantSwitchOptions; track tenant.id) {
            <button
              type="button"
              role="option"
              [attr.aria-selected]="tenant.id === activeTenantId"
              (click)="selectTenant(tenant.id)"
              class="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60"
              [class.bg-blue-50]="tenant.id === activeTenantId"
              [class.dark:bg-blue-900/30]="tenant.id === activeTenantId"
              [title]="'Switch to ' + tenant.name"
            >
              <span class="truncate">{{ tenant.name }}</span>
              @if (tenant.id === activeTenantId) {
                <span class="ml-2 shrink-0 text-blue-600 dark:text-blue-400"
                  >✓</span
                >
              }
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class TenantSwitcherDropdownComponent implements OnInit, OnDestroy {
  @Input() compact = false;
  @Input() triggerId = 'tenant-switcher-dropdown-trigger';
  @Output() tenantSelected = new EventEmitter<string>();

  showDropdown = false;
  private destroy$ = new Subject<void>();

  constructor(
    private tenantContextService: TenantContextService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.tenantContextService.activeTenant$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());

    this.tenantContextService.availableTenants$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());

    this.tenantContextService.memberships$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showDropdown) {
      this.closeDropdown();
    }
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

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
    this.cdr.markForCheck();
  }

  closeDropdown(): void {
    if (!this.showDropdown) {
      return;
    }
    this.showDropdown = false;
    this.cdr.markForCheck();
  }

  selectTenant(tenantId: string): void {
    this.closeDropdown();
    if (!tenantId || tenantId === this.activeTenantId) {
      return;
    }
    this.tenantSelected.emit(tenantId);
  }
}
