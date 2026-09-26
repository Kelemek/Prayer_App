import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { Tenant, TenantMembership, TenantUserDirectoryRow } from '../types/tenant';
import { TenantContextService } from './tenant-context.service';
import {
  mergeUsersWithTenantsAndGroups,
  type TenantUserDirectoryGroupMemberRow,
  type TenantUserDirectoryMembershipRow,
} from '../lib/tenant-user-directory';

@Injectable({
  providedIn: 'root'
})
export class TenantManagementService {
  constructor(
    private supabase: SupabaseService,
    private tenantContext: TenantContextService,
  ) {}

  async createTenant(
    name: string,
    slug: string,
    planTier: Tenant['plan_tier'] = 'groups',
    planStatus: Tenant['plan_status'] = planTier === 'churches' ? 'incomplete' : 'active'
  ): Promise<Tenant> {
    const userEmail = await this.getCurrentUserEmail();
    if (!userEmail) {
      throw new Error('You must be logged in to create a tenant');
    }

    const { data: { session } } = await this.supabase.client.auth.getSession();
    const hasSupabaseJwt = !!session?.access_token;

    const { data: tenant, error } = await this.supabase.client.rpc('create_tenant_for_user', {
      p_name: name,
      p_slug: slug,
      p_plan_tier: planTier,
      p_plan_status: planStatus,
      // MFA-only sessions have no JWT; RPC needs explicit email + DB-side authorization.
      ...(hasSupabaseJwt ? {} : { p_email: userEmail })
    });

    if (error || !tenant) {
      throw new Error(error?.message || 'Failed to create tenant');
    }

    await this.tenantContext.refresh();
    return tenant as Tenant;
  }

  async setTenantPlan(tenantId: string, planTier: Tenant['plan_tier'], status: Tenant['plan_status'] = 'active'): Promise<void> {
    const actorEmail = await this.getCurrentUserEmail();
    const { error } = await this.supabase.client.rpc('update_tenant_subscription', {
      p_tenant_id: tenantId,
      p_plan_tier: planTier,
      p_status: status,
      p_source: 'manual',
      p_created_by_email: actorEmail
    });

    if (error) {
      throw new Error(error.message);
    }

    await this.tenantContext.refresh();
  }

  /** Resolves the signed-in actor (Supabase session or MFA local email). */
  getActorEmail(): Promise<string | null> {
    return this.getCurrentUserEmail();
  }

  /** Stored free-tier display name for the signed-in user, if any. */
  async getActorDisplayName(): Promise<string> {
    const email = await this.getCurrentUserEmail();
    if (!email) {
      return '';
    }
    try {
      const { data } = await this.supabase.client
        .from('user_subscriptions')
        .select('display_name')
        .eq('user_email', email.toLowerCase().trim())
        .maybeSingle();
      return typeof data?.display_name === 'string' ? data.display_name.trim() : '';
    } catch {
      return '';
    }
  }

  /**
   * All super admin emails (caller must already be super admin; uses RPC for MFA-safe listing).
   */
  async listSuperAdmins(): Promise<{ user_email: string }[]> {
    const actor = await this.getCurrentUserEmail();
    if (!actor) {
      throw new Error('You must be logged in');
    }

    const { data, error } = await this.supabase.client.rpc('list_super_admins_for_caller', {
      p_actor_email: actor.toLowerCase().trim()
    });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as { user_email: string }[];
  }

  async assignSuperAdmin(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const { error } = await this.supabase.client
      .from('global_roles')
      .upsert({
        user_email: normalizedEmail,
        role: 'super_admin'
      }, { onConflict: 'user_email' });

    if (error) {
      throw new Error(error.message);
    }
  }

  async removeSuperAdmin(email: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('global_roles')
      .delete()
      .eq('user_email', email.toLowerCase().trim())
      .eq('role', 'super_admin');

    if (error) {
      throw new Error(error.message);
    }

    await this.tenantContext.refresh();
  }

  async getMembershipsForActiveTenant(): Promise<TenantMembership[]> {
    const tenantId = this.tenantContext.getActiveTenant()?.id;
    if (!tenantId) return [];
    const { data, error } = await this.supabase.client
      .from('tenant_memberships')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }
    return (data || []) as TenantMembership[];
  }

  /**
   * Super-admin directory of every person in a tenant or prayer group,
   * merged by email with stacked tenant and group names.
   */
  async listUsersWithTenantsAndGroups(): Promise<TenantUserDirectoryRow[]> {
    const [membershipsResult, groupMembersResult] = await Promise.all([
      this.supabase.client
        .from('tenant_memberships')
        .select('user_email, name, tenants(id, name)'),
      this.supabase.client
        .from('prayer_group_members')
        .select('user_email, name, prayer_groups(id, name)'),
    ]);

    if (membershipsResult.error) {
      throw new Error(membershipsResult.error.message);
    }
    if (groupMembersResult.error) {
      throw new Error(groupMembersResult.error.message);
    }

    return mergeUsersWithTenantsAndGroups(
      (membershipsResult.data || []) as TenantUserDirectoryMembershipRow[],
      (groupMembersResult.data || []) as TenantUserDirectoryGroupMemberRow[]
    );
  }

  private async getCurrentUserEmail(): Promise<string | null> {
    const { data: { session } } = await this.supabase.client.auth.getSession();
    return session?.user?.email || null;
  }

}
