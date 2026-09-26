import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TenantSwitcherControlComponent } from '../../tenant-switcher-control/tenant-switcher-control.component';
import { TenantContextService } from '../../../services/tenant-context.service';
import { USER_SETTINGS_SECTION_HOST_STYLES } from '../user-settings-section-host';

@Component({
  selector: 'app-user-settings-organization-section',
  standalone: true,
  imports: [TenantSwitcherControlComponent],
  templateUrl: './user-settings-organization-section.component.html',
  styles: [...USER_SETTINGS_SECTION_HOST_STYLES],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserSettingsOrganizationSectionComponent implements OnInit, OnDestroy {
  tenantContextLoading = true;

  private destroy$ = new Subject<void>();

  constructor(
    private tenantContextService: TenantContextService,
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

  get showSection(): boolean {
    return (
      !this.tenantContextLoading &&
      !!this.tenantContextService.getActiveTenant()?.id &&
      this.tenantSwitchOptionCount > 1
    );
  }

  private get tenantSwitchOptionCount(): number {
    const options = this.tenantContextService.getTenantSwitcherOptions();
    const unique = new Set(options.map((tenant) => tenant.id));
    const active = this.tenantContextService.getActiveTenant();
    if (active?.id) {
      unique.add(active.id);
    }
    return unique.size;
  }
}
