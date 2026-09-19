import { Injectable } from '@angular/core';
import type { PlatformQuotaUsageSnapshot } from '../types/platform-quota-usage';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class PlatformQuotaUsageService {
  constructor(private supabase: SupabaseService) {}

  async loadSnapshot(): Promise<PlatformQuotaUsageSnapshot | null> {
    const { data, error } = await this.supabase.client.rpc(
      'list_platform_quota_usage_for_super_admin'
    );
    if (error) {
      const message = error.message ?? '';
      if (
        message.includes('Could not find the function') ||
        message.includes('list_platform_quota_usage_for_super_admin')
      ) {
        return null;
      }
      throw new Error(message);
    }
    const payload = data as PlatformQuotaUsageSnapshot | null;
    return {
      users: payload?.users ?? [],
      tenants: payload?.tenants ?? [],
    };
  }
}
