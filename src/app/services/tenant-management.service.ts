import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { Tenant, TenantMembership } from '../types/tenant';
import { TenantContextService } from './tenant-context.service';

@Injectable({
  providedIn: 'root'
})
export class TenantManagementService {
  constructor(
    private supabase: SupabaseService,
    private tenantContext: TenantContextService
  ) {}

  async createTenant(name: string, slug: string, planTier: Tenant['plan_tier'] = 'groups'): Promise<Tenant> {
    const userEmail = await this.getCurrentUserEmail();
    if (!userEmail) {
      throw new Error('You must be logged in to create a tenant');
    }

    const { data: tenant, error } = await this.supabase.client
      .from('tenants')
      .insert({
        name,
        slug,
        plan_tier: planTier,
        plan_status: 'active',
        created_by_email: userEmail
      })
      .select('id, name, slug, plan_tier, plan_status')
      .single();

    if (error || !tenant) {
      throw new Error(error?.message || 'Failed to create tenant');
    }

    const { error: membershipError } = await this.supabase.client
      .from('tenant_memberships')
      .insert({
        tenant_id: tenant.id,
        user_email: userEmail,
        role: 'tenant_admin'
      });

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    await this.tenantContext.refresh();
    return tenant as Tenant;
  }

  async createInvite(tenantId: string, email: string): Promise<string> {
    const inviterEmail = await this.getCurrentUserEmail();
    if (!inviterEmail) {
      throw new Error('You must be logged in to invite members');
    }

    const { data, error } = await this.supabase.client.rpc('create_tenant_invite', {
      p_tenant_id: tenantId,
      p_invitee_email: email.toLowerCase().trim(),
      p_invited_by_email: inviterEmail.toLowerCase().trim(),
      p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create invite');
    }

    return data as string;
  }

  async claimInvite(token: string): Promise<void> {
    const userEmail = await this.getCurrentUserEmail();
    if (!userEmail) {
      throw new Error('You must be logged in to claim an invite');
    }

    const { data: invite, error: inviteError } = await this.supabase.client
      .from('tenant_invites')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (inviteError || !invite) {
      throw new Error('Invite not found or already used');
    }

    if (invite.email.toLowerCase().trim() !== userEmail.toLowerCase().trim()) {
      throw new Error('Invite email does not match this user');
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new Error('Invite has expired');
    }

    const { error: membershipError } = await this.supabase.client
      .from('tenant_memberships')
      .insert({
        tenant_id: invite.tenant_id,
        user_email: userEmail.toLowerCase().trim(),
        role: 'member'
      });

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    const { error: inviteUpdateError } = await this.supabase.client
      .from('tenant_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invite.id);

    if (inviteUpdateError) {
      throw new Error(inviteUpdateError.message);
    }

    await this.tenantContext.refresh();
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

  private async getCurrentUserEmail(): Promise<string | null> {
    const { data: { session } } = await this.supabase.client.auth.getSession();
    return session?.user?.email || localStorage.getItem('mfa_authenticated_email');
  }
}
