import type { SupabaseClient } from '@supabase/supabase-js';
import type { InAppBadgeReceiptRow } from './in-app-prayer-badge-count';

export const TENANT_BADGE_RECEIPT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TenantInAppBadgeReceiptSync {
  private syncInFlight: Promise<void> | null = null;
  lastNetworkSyncAt: number | null = null;

  constructor(private readonly client: SupabaseClient) {}

  getSyncInFlight(): Promise<void> | null {
    return this.syncInFlight;
  }

  async loadReceipts(
    tenantId: string,
    email: string
  ): Promise<InAppBadgeReceiptRow[] | null> {
    try {
      const { data, error } = await this.client.rpc('get_badge_read_receipts', {
        p_tenant_id: tenantId,
        p_user_email: email,
      });
      if (error) {
        console.warn('[Badge] Failed to load read receipts:', error.message);
        return null;
      }
      this.lastNetworkSyncAt = Date.now();
      return (data || []) as InAppBadgeReceiptRow[];
    } catch (error) {
      console.warn('[Badge] Failed to load read receipts:', error);
      return null;
    }
  }

  async upsertReceipts(
    tenantId: string,
    email: string,
    receipts: InAppBadgeReceiptRow[]
  ): Promise<void> {
    if (receipts.length === 0) {
      return;
    }

    const valid = receipts.filter(
      (r) => r.item_id && TENANT_BADGE_RECEIPT_UUID_RE.test(r.item_id)
    );
    if (valid.length === 0) {
      return;
    }

    const run = async () => {
      const chunkSize = 200;
      for (let i = 0; i < valid.length; i += chunkSize) {
        const chunk = valid.slice(i, i + chunkSize);
        const { error } = await this.client.rpc('upsert_badge_read_receipts', {
          p_tenant_id: tenantId,
          p_item_kinds: chunk.map((r) => r.item_kind),
          p_item_ids: chunk.map((r) => r.item_id),
          p_user_email: email,
        });
        if (error) {
          console.warn('[Badge] Failed to upsert read receipts:', error.message);
        }
      }
    };

    this.syncInFlight = (this.syncInFlight ?? Promise.resolve())
      .then(run)
      .catch((error) => {
        console.warn('[Badge] Upsert queue failed:', error);
      });
    await this.syncInFlight;
  }
}
