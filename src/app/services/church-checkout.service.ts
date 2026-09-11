import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { getTenantOrigin } from '../lib/app-origin';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ChurchCheckoutService {
  constructor(private supabase: SupabaseService) {}

  isNativeStripeCheckoutUi(): boolean {
    return Capacitor.isNativePlatform();
  }

  async startChurchCheckout(
    tenantId: string,
    tenantSlug?: string
  ): Promise<string | null> {
    const session = await this.supabase.client.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      return null;
    }

    const response = await fetch(
      `${this.supabase.getSupabaseUrl()}/functions/v1/stripe-church-checkout`,
      {
        method: 'POST',
        headers: {
          apikey: this.supabase.getPublishableKey(),
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          return_origin: tenantSlug ? getTenantOrigin(tenantSlug) : undefined,
        }),
      }
    );

    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok) {
      console.error('[ChurchCheckout] failed:', payload.error);
      return null;
    }
    return payload.url ?? null;
  }

  async startBillingPortal(
    tenantId: string,
    tenantSlug?: string
  ): Promise<string | null> {
    const session = await this.supabase.client.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      return null;
    }

    const response = await fetch(
      `${this.supabase.getSupabaseUrl()}/functions/v1/stripe-billing-portal`,
      {
        method: 'POST',
        headers: {
          apikey: this.supabase.getPublishableKey(),
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          return_origin: tenantSlug ? getTenantOrigin(tenantSlug) : undefined,
        }),
      }
    );

    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok) {
      console.error('[ChurchBillingPortal] failed:', payload.error);
      return null;
    }
    return payload.url ?? null;
  }

  async openBillingUrl(url: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url });
      return;
    }
    window.location.assign(url);
  }
}
