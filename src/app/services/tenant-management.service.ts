import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { Tenant, TenantMembership, TenantUserDirectoryRow } from '../types/tenant';
import { TenantContextService } from './tenant-context.service';
import { EmailNotificationService } from './email-notification.service';
import { buildTenantInviteUrl } from '../lib/app-origin';
import {
  formatInviteExpiry,
  InviteEmailSendError,
  mapTenantInvitePreview,
  TENANT_INVITE_TEMPLATE_KEY,
  type CreatedTenantInvite,
  type TenantInvitePreview,
} from '../lib/tenant-invite';
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
    private emailNotification: EmailNotificationService
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

  async createInvite(tenantId: string, email: string): Promise<CreatedTenantInvite> {
    const inviterEmail = await this.getCurrentUserEmail();
    if (!inviterEmail) {
      throw new Error('You must be logged in to invite members');
    }

    const inviteeEmail = email.toLowerCase().trim();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.supabase.client.rpc('create_tenant_invite', {
      p_tenant_id: tenantId,
      p_invitee_email: inviteeEmail,
      p_invited_by_email: inviterEmail.toLowerCase().trim(),
      p_expires_at: expiresAt
    });

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create invite');
    }

    const token = data as string;
    let tenantName = 'this church';
    let tenantSlug = '';
    try {
      const tenant = await this.getTenantNameAndSlug(tenantId);
      tenantName = tenant.name;
      tenantSlug = tenant.slug;
    } catch (lookupError) {
      console.error('Failed to load tenant for invite email:', lookupError);
    }
    const url = buildTenantInviteUrl(tenantSlug, token);
    const created: CreatedTenantInvite = { token, url };

    try {
      await this.sendTenantInviteEmail({
        tenantId,
        tenantName,
        inviterEmail: inviterEmail.toLowerCase().trim(),
        inviteeEmail,
        expiresAt,
        joinLink: url,
      });
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : 'Failed to send invite email';
      throw new InviteEmailSendError(message, token, url);
    }

    return created;
  }

  async getInvitePreview(token: string): Promise<TenantInvitePreview | null> {
    const trimmed = token.trim();
    if (!trimmed) {
      return null;
    }
    const { data, error } = await this.supabase.client.rpc('get_tenant_invite_preview', {
      p_token: trimmed,
    });
    if (error) {
      throw new Error(error.message || 'Failed to load invite');
    }
    return mapTenantInvitePreview(data);
  }

  async claimInvite(token: string): Promise<string> {
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
    return invite.tenant_id as string;
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

  private async getTenantNameAndSlug(tenantId: string): Promise<{ name: string; slug: string }> {
    const { data, error } = await this.supabase.client
      .from('tenants')
      .select('name, slug')
      .eq('id', tenantId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message || 'Failed to load tenant');
    }
    return {
      name: (data?.name ?? '').trim() || 'this church',
      slug: (data?.slug ?? '').trim(),
    };
  }

  private async sendTenantInviteEmail(options: {
    tenantId: string;
    tenantName: string;
    inviterEmail: string;
    inviteeEmail: string;
    expiresAt: string;
    joinLink: string;
  }): Promise<void> {
    const variables = {
      tenantName: options.tenantName,
      inviterEmail: options.inviterEmail,
      inviteeEmail: options.inviteeEmail,
      expiresAt: formatInviteExpiry(options.expiresAt),
      joinLink: options.joinLink,
    };
    const template = await this.emailNotification.getTemplate(
      TENANT_INVITE_TEMPLATE_KEY,
      options.tenantId
    );
    let subject: string;
    let htmlBody: string;
    let textBody: string;
    if (template) {
      subject = this.emailNotification.applyTemplateVariables(template.subject, variables);
      htmlBody = this.emailNotification.applyTemplateVariables(template.html_body, variables);
      textBody = this.emailNotification.applyTemplateVariables(template.text_body, variables);
    } else {
      subject = `You're invited to join ${options.tenantName}`;
      htmlBody = this.buildInviteFallbackHtml(variables);
      textBody = this.buildInviteFallbackText(variables);
    }
    await this.emailNotification.sendEmail({
      to: options.inviteeEmail,
      subject,
      htmlBody,
      textBody,
      tenantId: options.tenantId,
    });
  }

  private buildInviteFallbackHtml(variables: {
    tenantName: string;
    inviterEmail: string;
    inviteeEmail: string;
    expiresAt: string;
    joinLink: string;
  }): string {
    return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"></head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
    <h1 style="color:#39704D;">You're invited</h1>
    <p>${variables.inviterEmail} invited you to join <strong>${variables.tenantName}</strong>.</p>
    <p>This invite is for <strong>${variables.inviteeEmail}</strong> and expires on ${variables.expiresAt}.</p>
    <p><a href="${variables.joinLink}" style="display:inline-block;background:#39704D;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;">Join ${variables.tenantName}</a></p>
    <p style="font-size:13px;color:#6b7280;word-break:break-all;">${variables.joinLink}</p>
  </body>
</html>`;
  }

  private buildInviteFallbackText(variables: {
    tenantName: string;
    inviterEmail: string;
    inviteeEmail: string;
    expiresAt: string;
    joinLink: string;
  }): string {
    return `You're invited to join ${variables.tenantName}

${variables.inviterEmail} invited you to join ${variables.tenantName}.
This invite is for ${variables.inviteeEmail} and expires on ${variables.expiresAt}.

Sign in or sign up as that email, then open:
${variables.joinLink}
`;
  }
}
