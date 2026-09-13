import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { BillingSignupService } from '../../services/billing-signup.service';
import { ChurchCheckoutService } from '../../services/church-checkout.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import { switchTenantWithNavigation } from '../../lib/tenant-navigation';
import {
  normalizeTenantSlug,
  suggestTenantSlugFromName,
  validateTenantSlug,
} from '../../lib/tenant-slug';
import { resolveTenantHostSuffixForPreview } from '../../lib/app-origin';
import {
  BillingSignupEmailSendError,
  type ChurchSetupStatus,
} from '../../lib/billing-signup';
import {
  TENANT_SLUG_AVAILABILITY_DEBOUNCE_MS,
  slugAvailabilityBlocksSubmit,
  type SlugAvailabilityStatus,
} from '../../lib/tenant-slug-availability';

@Component({
  selector: 'app-church-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './church-setup.component.html',
})
export class ChurchSetupComponent implements OnInit, OnDestroy {
  status: ChurchSetupStatus = 'none';
  loading = true;
  submitting = false;
  nameDraft = '';
  slugDraft = '';
  slugTouched = false;
  checkoutStarting = false;
  emailingLink = false;
  slugAvailabilityStatus: SlugAvailabilityStatus = 'idle';

  get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  private readonly billingSignup = inject(BillingSignupService);
  private readonly churchCheckout = inject(ChurchCheckoutService);
  private readonly tenantContext = inject(TenantContextService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private slugAvailabilityRequestId = 0;
  private slugAvailabilityDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    this.clearSlugAvailabilityDebounce();
    this.slugAvailabilityRequestId += 1;
  }

  async ngOnInit(): Promise<void> {
    const checkout = this.route.snapshot.queryParamMap.get('church_checkout');
    if (checkout === 'success') {
      this.toast.success('Payment received. Name your church to finish setup.');
    } else if (checkout === 'cancel') {
      this.toast.info('Church checkout was canceled.');
    }
    if (checkout) {
      await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { church_checkout: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    await this.refreshState();
    if (checkout === 'success' && this.status !== 'paid_pending_setup' && this.status !== 'attached') {
      await this.refreshStateUntilReady();
    }
    if (this.status === 'attached') {
      await this.router.navigate(['/admin']);
      return;
    }
    if (this.status === 'paid_pending_setup') {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }
    if (!this.isNative) {
      await this.startCheckoutIfNeeded();
    }
    this.loading = false;
    this.cdr.markForCheck();
  }

  onNameInput(value: string): void {
    this.nameDraft = value;
    if (!this.slugTouched) {
      this.slugDraft = suggestTenantSlugFromName(value);
    }
    this.queueSlugAvailabilityCheck();
    this.cdr.markForCheck();
  }

  onSlugInput(value: string): void {
    this.slugTouched = true;
    this.slugDraft = value;
    this.queueSlugAvailabilityCheck();
    this.cdr.markForCheck();
  }

  get slugValidationError(): string | null {
    const slug = normalizeTenantSlug(this.slugDraft);
    if (!slug) {
      return null;
    }
    return validateTenantSlug(slug);
  }

  get canSubmit(): boolean {
    const slug = normalizeTenantSlug(this.slugDraft);
    return (
      !this.submitting &&
      this.nameDraft.trim().length > 0 &&
      slug.length > 0 &&
      this.slugValidationError === null &&
      !slugAvailabilityBlocksSubmit(this.slugAvailabilityStatus)
    );
  }

  get webAddressHostSuffix(): string {
    return resolveTenantHostSuffixForPreview();
  }

  get webAddressPreview(): string {
    const slug =
      normalizeTenantSlug(this.slugDraft) ||
      this.slugDraft.trim() ||
      'your-church-name';
    return `https://${slug}.${this.webAddressHostSuffix}`;
  }

  async submitSetup(): Promise<void> {
    const name = this.nameDraft.trim();
    const slug = normalizeTenantSlug(this.slugDraft);
    if (!name || !slug || this.submitting) {
      return;
    }
    const slugError = validateTenantSlug(slug);
    if (slugError) {
      this.toast.error(slugError);
      return;
    }
    if (this.slugAvailabilityStatus === 'taken') {
      this.toast.error('This web address is already taken. Try another.');
      return;
    }
    if (slugAvailabilityBlocksSubmit(this.slugAvailabilityStatus)) {
      return;
    }
    this.submitting = true;
    this.cdr.markForCheck();
    try {
      const tenant = await this.billingSignup.completeChurchSetup(name, slug);
      await this.tenantContext.refresh();
      const navResult = await switchTenantWithNavigation(
        tenant.id,
        tenant.slug,
        (id) => this.tenantContext.switchTenant(id)
      );
      if (navResult !== 'navigated') {
        await this.router.navigate(['/admin']);
      }
      this.toast.success(`Church "${tenant.name}" is ready`);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Failed to finish church setup');
    } finally {
      this.submitting = false;
      this.cdr.markForCheck();
    }
  }

  async emailSetupLink(): Promise<void> {
    if (this.emailingLink) {
      return;
    }
    this.emailingLink = true;
    this.cdr.markForCheck();
    try {
      const created = await this.billingSignup.sendSignupEmail('church');
      this.toast.success('Check your email for a link to continue on the web.');
      try {
        await navigator.clipboard.writeText(created.url);
        this.toast.success('Setup link copied');
      } catch {
        this.toast.info(created.url);
      }
    } catch (error) {
      if (error instanceof BillingSignupEmailSendError) {
        this.toast.error('Could not send email. Copy the link to continue on the web.');
        try {
          await navigator.clipboard.writeText(error.url);
          this.toast.success('Setup link copied');
        } catch {
          this.toast.info(error.url);
        }
        return;
      }
      this.toast.error(error instanceof Error ? error.message : 'Could not email a setup link');
    } finally {
      this.emailingLink = false;
      this.cdr.markForCheck();
    }
  }

  async startCheckoutIfNeeded(): Promise<void> {
    if (this.checkoutStarting || this.isNative) {
      return;
    }
    this.checkoutStarting = true;
    this.cdr.markForCheck();
    try {
      const url = await this.churchCheckout.startChurchCheckout();
      if (url === 'setup_pending') {
        this.status = 'paid_pending_setup';
        return;
      }
      if (url) {
        await this.churchCheckout.openBillingUrl(url);
        return;
      }
      if (this.status !== 'paid_pending_setup') {
        this.toast.error('Could not start checkout. Please try again.');
      }
    } finally {
      this.checkoutStarting = false;
      this.cdr.markForCheck();
    }
  }

  private async refreshState(): Promise<void> {
    const state = await this.billingSignup.getChurchSetupState();
    this.status = state.status;
    this.cdr.markForCheck();
  }

  private async refreshStateUntilReady(): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
      await this.refreshState();
      if (this.status === 'paid_pending_setup' || this.status === 'attached') {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  private queueSlugAvailabilityCheck(): void {
    this.clearSlugAvailabilityDebounce();
    this.slugAvailabilityRequestId += 1;

    const normalized = normalizeTenantSlug(this.slugDraft);
    const validationError = validateTenantSlug(normalized);
    if (!normalized) {
      this.slugAvailabilityStatus = 'idle';
      return;
    }
    if (validationError) {
      this.slugAvailabilityStatus = 'invalid';
      return;
    }

    this.slugAvailabilityStatus = 'idle';
    this.slugAvailabilityDebounceTimer = setTimeout(() => {
      const requestId = this.slugAvailabilityRequestId;
      this.slugAvailabilityDebounceTimer = null;
      void this.runSlugAvailabilityCheck(normalized, requestId);
    }, TENANT_SLUG_AVAILABILITY_DEBOUNCE_MS);
  }

  private clearSlugAvailabilityDebounce(): void {
    if (this.slugAvailabilityDebounceTimer !== null) {
      clearTimeout(this.slugAvailabilityDebounceTimer);
      this.slugAvailabilityDebounceTimer = null;
    }
  }

  private async runSlugAvailabilityCheck(normalized: string, requestId: number): Promise<void> {
    this.slugAvailabilityStatus = 'checking';
    this.cdr.markForCheck();

    const available = await this.billingSignup.isTenantSlugAvailable(normalized);
    if (requestId !== this.slugAvailabilityRequestId) {
      return;
    }
    if (normalizeTenantSlug(this.slugDraft) !== normalized) {
      return;
    }

    if (available === true) {
      this.slugAvailabilityStatus = 'available';
    } else if (available === false) {
      this.slugAvailabilityStatus = 'taken';
    } else {
      this.slugAvailabilityStatus = 'idle';
    }
    this.cdr.markForCheck();
  }
}
