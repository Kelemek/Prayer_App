import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ChurchCheckoutService {
  constructor(private supabase: SupabaseService) {}

  async startChurchCheckout(tenantId: string): Promise<string | null> {
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
        body: JSON.stringify({ tenant_id: tenantId }),
      }
    );

    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok) {
      console.error('[ChurchCheckout] failed:', payload.error);
      return null;
    }
    return payload.url ?? null;
  }
}
