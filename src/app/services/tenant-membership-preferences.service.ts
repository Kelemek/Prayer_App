import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantContextService } from './tenant-context.service';

export type TenantMembershipPreferenceUpdate = Record<string, unknown>;

type MembershipWriteResult = {
  data: { id: string }[] | null;
  error: { message?: string } | null;
};

@Injectable({ providedIn: 'root' })
export class TenantMembershipPreferencesService {
  constructor(
    private supabase: SupabaseService,
    private tenantContext: TenantContextService
  ) {}

  matchFilter(email: string): { user_email: string; tenant_id?: string } {
    const filter: { user_email: string; tenant_id?: string } = {
      user_email: email,
    };
    const tenantId = this.tenantContext.getActiveTenant()?.id;
    if (tenantId) {
      filter.tenant_id = tenantId;
    }
    return filter;
  }

  insertPayload(
    email: string,
    fields: TenantMembershipPreferenceUpdate
  ): Record<string, unknown> {
    const tenantId = this.tenantContext.getActiveTenant()?.id;
    return {
      user_email: email,
      role: 'member',
      ...(tenantId ? { tenant_id: tenantId } : {}),
      ...fields,
    };
  }

  /**
   * Upsert a tenant_memberships row for the active tenant (or email-only when no tenant).
   * Creates a row when missing; updates by id when present.
   */
  async upsert(
    email: string,
    update: TenantMembershipPreferenceUpdate,
    insertDefaults: TenantMembershipPreferenceUpdate = {}
  ): Promise<{ ok: true } | { ok: false; error: unknown }> {
    const normalized = email.toLowerCase().trim();
    if (!normalized) {
      return { ok: false, error: new Error('Email not found') };
    }

    const { data: existing, error: fetchError } = await this.supabase.client
      .from('tenant_memberships')
      .select('id')
      .match(this.matchFilter(normalized))
      .maybeSingle();

    if (fetchError) {
      return { ok: false, error: fetchError };
    }

    if (existing) {
      const updated = await this.supabase.client
        .from('tenant_memberships')
        .update(update)
        .eq('id', existing.id)
        .select('id');
      return this.requireUpdatedRow(updated);
    }

    const { error: insertError } = await this.supabase.client
      .from('tenant_memberships')
      .insert(this.insertPayload(normalized, { ...insertDefaults, ...update }));

    if (insertError) {
      return { ok: false, error: insertError };
    }
    return { ok: true };
  }

  /**
   * Update membership fields for the active tenant. Fails when no row exists.
   */
  async updateOnly(
    email: string,
    update: TenantMembershipPreferenceUpdate
  ): Promise<{ ok: true } | { ok: false; error: unknown }> {
    const normalized = email.toLowerCase().trim();
    if (!normalized) {
      return { ok: false, error: new Error('Email not found') };
    }

    const updated = await this.supabase.client
      .from('tenant_memberships')
      .update(update)
      .match(this.matchFilter(normalized))
      .select('id');
    return this.requireUpdatedRow(updated);
  }

  /** PostgREST returns no error when RLS hides every row. An empty result is a failed save. */
  private requireUpdatedRow(
    result: MembershipWriteResult
  ): { ok: true } | { ok: false; error: unknown } {
    if (result.error) return { ok: false, error: result.error };
    if (!result.data?.length) {
      return { ok: false, error: new Error('Could not save preference') };
    }
    return { ok: true };
  }
}
