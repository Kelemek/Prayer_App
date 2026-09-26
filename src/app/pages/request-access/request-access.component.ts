import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LoginPageLayoutComponent } from '../../components/login-page-layout/login-page-layout.component';
import { LoginHeaderComponent } from '../../components/login-header/login-header.component';
import { LoginRegistrationFormComponent } from '../../components/login-registration-form/login-registration-form.component';
import { LoginAccountStatusComponent } from '../../components/login-account-status/login-account-status.component';
import { TenantAccessService } from '../../services/tenant-access.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { AdminAuthService } from '../../services/admin-auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { getPlatformOrigin } from '../../lib/app-origin';
import {
  nextTenantAccessPhase,
  requiresAffiliationForPhase,
  type TenantAccessPhase,
} from '../../lib/tenant-access-flow';
import { switchTenantWithNavigation } from '../../lib/tenant-navigation';

@Component({
  selector: 'app-request-access',
  standalone: true,
  imports: [
    RouterModule,
    LoginPageLayoutComponent,
    LoginHeaderComponent,
    LoginRegistrationFormComponent,
    LoginAccountStatusComponent,
  ],
  template: `
    <app-login-page-layout>
      <app-login-header
        [tenantName]="tenantName"
        [logoUrl]="logoUrl"
        subtitle="Request access to join this prayer community"
      />

      @if (phase === 'loading') {
        <p class="text-center text-white text-sm">Loading…</p>
      }

      @if (phase === 'error') {
        <div class="bg-white rounded-lg p-4 text-sm text-red-700">{{ errorMessage }}</div>
      }

      @if (phase === 'name' || phase === 'request') {
        <app-login-registration-form
          [requiresApproval]="requiresAffiliation"
          [loading]="submitting"
          [error]="formError"
          [firstName]="firstName"
          [lastName]="lastName"
          [affiliationReason]="affiliationReason"
          (firstNameChange)="firstName = $event"
          (lastNameChange)="lastName = $event"
          (affiliationChange)="affiliationReason = $event"
          (submit)="onSubmit()"
        />
      }

      @if (phase === 'pending_approval') {
        <app-login-account-status kind="pending_approval" />
        <div class="mt-4 flex flex-col gap-2 text-center">
          <button type="button" class="text-sm text-white underline" (click)="signOut()">
            Sign out
          </button>
          <a [href]="platformHome" class="text-sm text-emerald-100 underline">Platform home</a>
        </div>
      }

      @if (phase === 'blocked') {
        <app-login-account-status kind="blocked" />
      }
    </app-login-page-layout>
  `,
})
export class RequestAccessComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantAccess = inject(TenantAccessService);
  private readonly tenantContext = inject(TenantContextService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly supabase = inject(SupabaseService);
  private readonly cdr = inject(ChangeDetectorRef);

  tenantId = '';
  tenantSlug = '';
  tenantName = '';
  logoUrl: string | null = null;
  phase: TenantAccessPhase = 'loading';
  joinViaPcoAfterName = false;
  firstName = '';
  lastName = '';
  affiliationReason = '';
  submitting = false;
  formError = '';
  errorMessage = '';
  platformHome = getPlatformOrigin() || '/';

  get requiresAffiliation(): boolean {
    return requiresAffiliationForPhase(this.phase);
  }

  async ngOnInit(): Promise<void> {
    const church = this.route.snapshot.queryParamMap.get('church');
    const tenant = await this.tenantAccess.resolveTargetTenant(church);
    if (!tenant) {
      this.phase = 'error';
      this.errorMessage =
        'We could not find this church. Check the web address or ask your church administrator.';
      this.cdr.markForCheck();
      return;
    }

    this.tenantId = tenant.id;
    this.tenantSlug = tenant.slug;
    this.tenantName = tenant.name;

    try {
      const { data } = await this.supabase.client.rpc('get_public_tenant_branding', {
        p_tenant_id: tenant.id,
      });
      const row = (data as Array<Record<string, unknown>> | null)?.[0];
      const useLogo = row?.['use_logo'] === true;
      const light = row?.['light_mode_logo_blob'];
      this.logoUrl =
        useLogo && typeof light === 'string' && light.trim() ? light : null;
    } catch {
      this.logoUrl = null;
    }

    await this.refreshPhase();
  }

  private async refreshPhase(): Promise<void> {
    try {
      const stateResult = await this.tenantAccess.getState(this.tenantId);
      if (stateResult.state === 'member') {
        await this.finishAsMember();
        return;
      }
      if (stateResult.state === 'blocked') {
        this.phase = 'blocked';
        this.cdr.markForCheck();
        return;
      }
      if (stateResult.state === 'pending') {
        this.phase = 'pending_approval';
        this.cdr.markForCheck();
        return;
      }
      if (stateResult.state === 'needs_name') {
        this.prefillName(stateResult.name);
        this.joinViaPcoAfterName = false;
        this.phase = 'name';
        this.cdr.markForCheck();
        return;
      }

      let pcoMatch: boolean | null = null;
      if (stateResult.pco_enabled) {
        const pco = await this.tenantAccess.checkPco(this.tenantId);
        pcoMatch = pco.pco_match;
        if (pco.pco_match) {
          this.prefillName(
            [pco.first_name, pco.last_name].filter(Boolean).join(' ') || stateResult.name,
          );
          this.joinViaPcoAfterName = true;
        }
      } else {
        pcoMatch = false;
      }

      this.phase = nextTenantAccessPhase('none', pcoMatch);
      if (this.phase === 'loading') {
        this.phase = 'request';
      }
      this.cdr.markForCheck();
    } catch (err) {
      this.phase = 'error';
      this.errorMessage =
        err instanceof Error ? err.message : 'Unable to load access status.';
      this.cdr.markForCheck();
    }
  }

  private prefillName(fullName?: string | null): void {
    const trimmed = (fullName ?? '').trim();
    if (!trimmed) {
      return;
    }
    const parts = trimmed.split(/\s+/);
    this.firstName = parts[0] ?? '';
    this.lastName = parts.slice(1).join(' ');
  }

  async onSubmit(): Promise<void> {
    this.formError = '';
    this.submitting = true;
    this.cdr.markForCheck();
    try {
      if (this.phase === 'request') {
        await this.tenantAccess.submitRequest(
          this.tenantId,
          this.firstName.trim(),
          this.lastName.trim(),
          this.affiliationReason.trim(),
        );
        this.phase = 'pending_approval';
      } else if (this.joinViaPcoAfterName) {
        await this.tenantAccess.joinViaPco(
          this.tenantId,
          this.firstName.trim(),
          this.lastName.trim(),
        );
        await this.finishAsMember();
      } else {
        await this.tenantAccess.completeProfile(
          this.tenantId,
          this.firstName.trim(),
          this.lastName.trim(),
        );
        await this.finishAsMember();
      }
    } catch (err) {
      this.formError = err instanceof Error ? err.message : 'Something went wrong.';
    } finally {
      this.submitting = false;
      this.cdr.markForCheck();
    }
  }

  private async finishAsMember(): Promise<void> {
    await this.tenantContext.refresh();
    const nav = await switchTenantWithNavigation(this.tenantId, this.tenantSlug, (id) =>
      this.tenantContext.switchTenant(id),
    );
    if (nav === 'navigated') {
      return;
    }
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
    await this.router.navigateByUrl(returnUrl);
  }

  async signOut(): Promise<void> {
    await this.adminAuth.logout();
    await this.router.navigate(['/login']);
  }
}
