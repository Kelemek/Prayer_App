import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ProCheckoutService {
  constructor(private supabase: SupabaseService) {}

  async startProCheckout(): Promise<string | null> {
    const session = await this.supabase.client.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      return null;
    }

    const response = await fetch(
      `${this.supabase.getSupabaseUrl()}/functions/v1/stripe-pro-checkout`,
      {
        method: 'POST',
        headers: {
          apikey: this.supabase.getPublishableKey(),
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok) {
      console.error('[ProCheckout] failed:', payload.error);
      return null;
    }
    return payload.url ?? null;
  }
}
