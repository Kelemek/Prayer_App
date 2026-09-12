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
    navigate = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ChurchSetupComponent],
      providers: [
        {
          provide: BillingSignupService,
          useValue: { getChurchSetupState, completeChurchSetup, sendSignupEmail },
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
    fixture?.destroy();
  });

  it('shows the name/slug wizard when payment is pending setup', async () => {
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    expect(startChurchCheckout).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Payment is confirmed');
    expect(fixture.nativeElement.textContent).toContain('Church name');
  });

  it('does not create a tenant until submit', async () => {
    await fixture.componentInstance.ngOnInit();
    expect(completeChurchSetup).not.toHaveBeenCalled();
    fixture.componentInstance.onNameInput('New Church');
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
