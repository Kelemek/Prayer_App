import { Injectable, inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { environment } from '../../environments/environment';
import { parseHost, isTenantSlugHost } from '../lib/tenant-host';
import { parseChurchSlugFromInput } from '../lib/parse-church-slug-input';
import {
  clearTenantAccessMemberCache,
  readTenantAccessMemberCache,
  writeTenantAccessMemberCache,
} from '../lib/tenant-access-guard-cache';
import { SupabaseService } from './supabase.service';
import { AuthIdentityService } from './auth-identity.service';
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
  private readonly authIdentity = inject(AuthIdentityService);
  private readonly router = inject(Router);

  private hostConfig() {
    return {
      platformHosts: environment.platformHosts ?? [],
      tenantHostSuffix: environment.tenantHostSuffix ?? '',
    };
  }

  private isOnTenantSlugHost(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return isTenantSlugHost(parseHost(window.location.hostname, this.hostConfig()));
  }

  private requestAccessUrlTree(returnUrl: string): UrlTree {
    return this.router.createUrlTree(['/request-access'], {
      queryParams: { returnUrl },
    });
  }

  private scheduleMemberRevalidate(
    tenantId: string,
    userKey: string,
    returnUrl: string
  ): void {
    void this.getState(tenantId)
      .then((access) => {
        if (access.state === 'member') {
          writeTenantAccessMemberCache(tenantId, userKey);
          return;
        }
        clearTenantAccessMemberCache(tenantId, userKey);
        if (this.isOnTenantSlugHost()) {
          void this.router.navigate(['/request-access'], {
            queryParams: { returnUrl },
          });
        }
      })
      .catch(() => {
        clearTenantAccessMemberCache(tenantId, userKey);
      });
  }

  /**
   * Slug-host route guard: member check with short-lived session cache.
   * Returns true when no slug target or access is allowed.
   */
  async resolveSlugHostMemberAccess(
    returnUrl: string
  ): Promise<boolean | UrlTree> {
    const target = await this.resolveTargetTenant(null);
    if (!target) {
      return true;
    }

    const userKey = await this.authIdentity.getSessionUserKey();
    if (userKey && readTenantAccessMemberCache(target.id, userKey)) {
      this.scheduleMemberRevalidate(target.id, userKey, returnUrl);
      return true;
    }

    try {
      const access = await this.getState(target.id);
      if (access.state === 'member') {
        if (userKey) {
          writeTenantAccessMemberCache(target.id, userKey);
        }
        return true;
      }
    } catch {
      return this.requestAccessUrlTree(returnUrl);
    }

    return this.requestAccessUrlTree(returnUrl);
  }

  async resolveTargetTenant(churchQuery?: string | null): Promise<ResolvedTargetTenant | null> {
    const config = this.hostConfig();

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
      throw new Error(error.message || 'Could not save your name.');
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
