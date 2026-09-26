import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { parseHost, isTenantSlugHost } from '../lib/tenant-host';
import { parseChurchSlugFromInput } from '../lib/parse-church-slug-input';
import { SupabaseService } from './supabase.service';
import { describeFunctionInvokeFailure } from '../utils/supabase-function-invoke-error';
import type { TenantAccessState } from '../lib/tenant-access-flow';

export interface ResolvedTargetTenant {
  id: string;
  name: string;
  slug: string;
}

export interface TenantAccessStateResult {
  state: TenantAccessState;
  name?: string | null;
  pco_enabled?: boolean;
  tenant_name?: string;
}

@Injectable({ providedIn: 'root' })
export class TenantAccessService {
  private readonly supabase = inject(SupabaseService);

  async resolveTargetTenant(churchQuery?: string | null): Promise<ResolvedTargetTenant | null> {
    const config = {
      platformHosts: environment.platformHosts ?? [],
      tenantHostSuffix: environment.tenantHostSuffix ?? '',
    };

    let slug: string | null = null;
    if (typeof window !== 'undefined') {
      const parsed = parseHost(window.location.hostname, config);
      if (isTenantSlugHost(parsed)) {
        slug = parsed.slug;
      }
    }

    const churchParam = churchQuery?.trim();
    if (!slug && churchParam) {
      slug = parseChurchSlugFromInput(churchParam, config.tenantHostSuffix ?? '');
    }

    if (!slug) {
      return null;
    }

    const { data, error } = await this.supabase.client.rpc('get_public_tenant_by_slug', {
      p_slug: slug,
    });
    if (error || !data?.length) {
      return null;
    }
    const row = data[0] as { id: string; name: string; slug: string };
    return { id: row.id, name: row.name, slug: row.slug };
  }

  async getState(tenantId: string): Promise<TenantAccessStateResult> {
    const { data, error } = await this.supabase.client.rpc('get_tenant_access_state', {
      p_tenant_id: tenantId,
    });
    if (error) {
      throw error;
    }
    const payload = (data ?? {}) as TenantAccessStateResult;
    return {
      state: (payload.state ?? 'none') as TenantAccessState,
      name: payload.name ?? null,
      pco_enabled: payload.pco_enabled,
      tenant_name: payload.tenant_name,
    };
  }

  async checkPco(tenantId: string): Promise<{
    pco_match: boolean;
    first_name?: string;
    last_name?: string;
  }> {
    const { data, error, response } = await this.supabase.client.functions.invoke('tenant-access', {
      body: { action: 'check_pco', tenant_id: tenantId },
    });
    if (error) {
      throw new Error(await describeFunctionInvokeFailure(error, response, 'tenant-access'));
    }
    return (data ?? { pco_match: false }) as {
      pco_match: boolean;
      first_name?: string;
      last_name?: string;
    };
  }

  async joinViaPco(
    tenantId: string,
    firstName: string,
    lastName: string,
  ): Promise<void> {
    const { error, response } = await this.supabase.client.functions.invoke('tenant-access', {
      body: {
        action: 'join_pco',
        tenant_id: tenantId,
        first_name: firstName,
        last_name: lastName,
      },
    });
    if (error) {
      throw new Error(await describeFunctionInvokeFailure(error, response, 'tenant-access'));
    }
  }

  async completeProfile(tenantId: string, firstName: string, lastName: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('complete_tenant_membership_profile', {
      p_tenant_id: tenantId,
      p_first_name: firstName,
      p_last_name: lastName,
    });
    if (error) {
      throw error;
    }
  }

  async submitRequest(
    tenantId: string,
    firstName: string,
    lastName: string,
    affiliationReason: string,
  ): Promise<void> {
    const { error, response } = await this.supabase.client.functions.invoke('tenant-access', {
      body: {
        action: 'request',
        tenant_id: tenantId,
        first_name: firstName,
        last_name: lastName,
        affiliation_reason: affiliationReason,
      },
    });
    if (error) {
      throw new Error(await describeFunctionInvokeFailure(error, response, 'tenant-access'));
    }
  }
}
