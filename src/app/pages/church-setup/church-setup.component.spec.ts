import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ChurchSetupComponent } from './church-setup.component';
import { BillingSignupService } from '../../services/billing-signup.service';
import { ChurchCheckoutService } from '../../services/church-checkout.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import { environment } from '../../../environments/environment';
import { TENANT_SLUG_AVAILABILITY_DEBOUNCE_MS } from '../../lib/tenant-slug-availability';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

import { Capacitor } from '@capacitor/core';

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const path = join(componentDir, url);
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8');
  }
  throw new Error(`Component resource not found: ${url}`);
}

describe('ChurchSetupComponent', () => {
  beforeAll(async () => {
    await resolveComponentResources((url) => Promise.resolve(readComponentResource(url)));
  });

  let fixture: ComponentFixture<ChurchSetupComponent>;
  let getChurchSetupState: ReturnType<typeof vi.fn>;
  let completeChurchSetup: ReturnType<typeof vi.fn>;
  let startChurchCheckout: ReturnType<typeof vi.fn>;
  let sendSignupEmail: ReturnType<typeof vi.fn>;
  let isTenantSlugAvailable: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    getChurchSetupState = vi.fn().mockResolvedValue({ status: 'paid_pending_setup' });
    completeChurchSetup = vi.fn().mockResolvedValue({
      id: 't1',
      slug: 'new-church',
      name: 'New Church',
    });
    startChurchCheckout = vi.fn().mockResolvedValue(null);
    sendSignupEmail = vi.fn().mockResolvedValue({
      url: 'https://app.example/church-setup?signup_token=tok',
      token: 'tok',
    });
    isTenantSlugAvailable = vi.fn().mockResolvedValue(true);
    navigate = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ChurchSetupComponent],
      providers: [
        {
          provide: BillingSignupService,
          useValue: {
            getChurchSetupState,
            completeChurchSetup,
            sendSignupEmail,
            isTenantSlugAvailable,
          },
        },
        {
          provide: ChurchCheckoutService,
          useValue: {
            startChurchCheckout,
            openBillingUrl: vi.fn(),
          },
        },
        {
          provide: TenantContextService,
          useValue: { refresh: vi.fn(), switchTenant: vi.fn().mockResolvedValue(true) },
        },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: vi.fn(() => null) } } },
        },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChurchSetupComponent);
  });

  afterEach(() => {
    vi.useRealTimers();
    fixture?.destroy();
  });

  it('shows the name/slug wizard when payment is pending setup', async () => {
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    expect(startChurchCheckout).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Payment is confirmed');
    expect(fixture.nativeElement.textContent).toContain('Church name');
    expect(fixture.nativeElement.textContent).toContain('Web address');
  });

  it('previews the church URL from the name', async () => {
    const originalSuffix = environment.tenantHostSuffix;
    environment.tenantHostSuffix = 'prayer.romans8.net';
    try {
      await fixture.componentInstance.ngOnInit();
      fixture.detectChanges();
      fixture.componentInstance.onNameInput('Hope Church');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.componentInstance.slugDraft).toBe('hope-church');
      expect(fixture.componentInstance.webAddressPreview).toBe(
        'https://hope-church.prayer.romans8.net'
      );
      expect(fixture.nativeElement.textContent).toContain('https://');
      expect(fixture.nativeElement.textContent).toContain('.prayer.romans8.net');
      const slugInput = fixture.nativeElement.querySelector(
        'input[name="churchWebAddress"]'
      ) as HTMLInputElement;
      expect(slugInput?.value).toBe('hope-church');
    } finally {
      environment.tenantHostSuffix = originalSuffix;
    }
  });

  it('debounces slug availability checks while typing', async () => {
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    vi.useFakeTimers();
    fixture.componentInstance.onNameInput('New Church');
    expect(isTenantSlugAvailable).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(TENANT_SLUG_AVAILABILITY_DEBOUNCE_MS);
    await vi.runAllTimersAsync();
    fixture.detectChanges();
    expect(isTenantSlugAvailable).toHaveBeenCalledWith('new-church');
    expect(fixture.nativeElement.textContent).toContain('This web address is available.');
  });

  it('shows taken when the web address is unavailable', async () => {
    isTenantSlugAvailable.mockResolvedValue(false);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    vi.useFakeTimers();
    fixture.componentInstance.onNameInput('Taken Church');
    await vi.advanceTimersByTimeAsync(TENANT_SLUG_AVAILABILITY_DEBOUNCE_MS);
    await vi.runAllTimersAsync();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('already taken');
    expect(fixture.componentInstance.canSubmit).toBe(false);
  });

  it('does not create a tenant until submit', async () => {
    await fixture.componentInstance.ngOnInit();
    expect(completeChurchSetup).not.toHaveBeenCalled();
    vi.useFakeTimers();
    fixture.componentInstance.onNameInput('New Church');
    await vi.advanceTimersByTimeAsync(TENANT_SLUG_AVAILABILITY_DEBOUNCE_MS);
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    await fixture.componentInstance.submitSetup();
    expect(completeChurchSetup).toHaveBeenCalledWith('New Church', 'new-church');
  });

  it('starts user-scoped checkout when unpaid on web', async () => {
    getChurchSetupState.mockResolvedValue({ status: 'none' });
    startChurchCheckout.mockResolvedValue('https://stripe.test/cs');
    await fixture.componentInstance.ngOnInit();
    expect(startChurchCheckout).toHaveBeenCalledWith();
  });

  it('does not start checkout on native and offers email-me instead', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    getChurchSetupState.mockResolvedValue({ status: 'none' });
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    expect(startChurchCheckout).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Email me a link to set up');
    expect(fixture.nativeElement.textContent).not.toContain('Continue to payment');
  });
});
