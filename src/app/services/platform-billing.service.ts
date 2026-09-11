import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface TenantBillingRow {
  id: string;
  name: string;
  slug: string;
  plan_tier: string;
  plan_status: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_cancel_at_period_end?: boolean;
  stripe_current_period_end?: string | null;
  past_due_since?: string | null;
  grace_until?: string | null;
  billing_past_due_notified_at?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class PlatformBillingService {
  constructor(private supabase: SupabaseService) {}

  async loadGraceDays(): Promise<number> {
    const { data, error } = await this.supabase.client.rpc('get_platform_billing_settings');
    if (error) {
      console.error('[PlatformBilling] get_platform_billing_settings failed:', error);
      return 7;
    }
    const days = Number((data as { church_past_due_grace_days?: number })?.church_past_due_grace_days ?? 7);
    return Number.isFinite(days) ? days : 7;
  }

  async saveGraceDays(days: number): Promise<void> {
    const { error } = await this.supabase.client.rpc('update_church_past_due_grace_days', {
      p_days: days,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  async listTenantBilling(): Promise<TenantBillingRow[]> {
    const { data, error } = await this.supabase.client.rpc('list_tenant_billing_for_super_admin');
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []) as TenantBillingRow[];
  }
}
