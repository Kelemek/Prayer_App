import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserSettingsBillingSectionComponent } from './user-settings-billing-section.component';
import { UserSubscriptionService } from '../../../services/user-subscription.service';
import { ProCheckoutService } from '../../../services/pro-checkout.service';
import { ToastService } from '../../../services/toast.service';

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const path = join(componentDir, url);
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8');
  }
  throw new Error(`Component resource not found: ${url}`);
}

describe('UserSettingsBillingSectionComponent', () => {
  const userSubscription = {
    refreshCapabilities: vi.fn().mockResolvedValue(undefined),
    hasProBillingPortal: vi.fn(),
  };
  const proCheckout = {
    startBillingPortal: vi.fn(),
    openBillingUrl: vi.fn(),
  };
  const toast = { error: vi.fn() };

  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  let fixture: ComponentFixture<UserSettingsBillingSectionComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [UserSettingsBillingSectionComponent],
    })
      .overrideProvider(UserSubscriptionService, { useValue: userSubscription })
      .overrideProvider(ProCheckoutService, { useValue: proCheckout })
      .overrideProvider(ToastService, { useValue: toast })
      .compileComponents();

    fixture = TestBed.createComponent(UserSettingsBillingSectionComponent);
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('hides section when user has no Pro billing portal', async () => {
    userSubscription.hasProBillingPortal.mockReturnValue(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Billing & invoices');
  });

  it('shows Billing & invoices when Pro customer id exists', async () => {
    userSubscription.hasProBillingPortal.mockReturnValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Billing & invoices');
  });
});
