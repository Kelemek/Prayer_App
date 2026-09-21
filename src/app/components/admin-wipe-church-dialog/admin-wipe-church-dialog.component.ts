import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import { invokeWipeChurchTenant, navigateAfterChurchWipe } from '../../lib/admin-wipe-church-run';
import { AppTopChromeOverlayDirective } from '../../directives/app-top-chrome-overlay.directive';

@Component({
  selector: 'app-admin-wipe-church-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, AppTopChromeOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-wipe-church-dialog.component.html',
})
export class AdminWipeChurchDialogComponent {
  @Input({ required: true }) tenantId!: string;
  @Input({ required: true }) tenantName!: string;
  @Input({ required: true }) tenantSlug!: string;
  @Input() open = false;

  @Output() openChange = new EventEmitter<boolean>();
  @Output() wiped = new EventEmitter<void>();

  confirmSlugInput = '';
  wiping = false;
  error: string | null = null;

  private readonly supabase = inject(SupabaseService);
  private readonly tenantContext = inject(TenantContextService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  get canSubmit(): boolean {
    return (
      !this.wiping &&
      this.confirmSlugInput.trim().toLowerCase() === this.tenantSlug.trim().toLowerCase()
    );
  }

  close(): void {
    if (this.wiping) {
      return;
    }
    this.confirmSlugInput = '';
    this.error = null;
    this.openChange.emit(false);
    this.cdr.markForCheck();
  }

  async confirmWipe(): Promise<void> {
    if (!this.canSubmit) {
      return;
    }
    this.wiping = true;
    this.error = null;
    this.cdr.markForCheck();

    const result = await invokeWipeChurchTenant(
      this.supabase,
      this.tenantId,
      this.confirmSlugInput.trim()
    );

    if (!result.success) {
      this.wiping = false;
      this.error = result.error ?? 'Could not delete church.';
      this.cdr.markForCheck();
      return;
    }

    this.toast.success(
      result.alreadyWiped
        ? 'This church was already deleted.'
        : 'Church deleted. Member accounts and personal prayers were kept.'
    );
    this.wiping = false;
    this.confirmSlugInput = '';
    this.openChange.emit(false);
    this.wiped.emit();
    this.cdr.markForCheck();

    await navigateAfterChurchWipe(this.tenantSlug, this.tenantContext, this.router);
  }
}
