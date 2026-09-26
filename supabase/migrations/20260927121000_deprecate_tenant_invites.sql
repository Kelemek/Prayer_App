-- Deprecate church invite tokens (table retained for erase/export).

drop function if exists public.claim_tenant_invite(text, text);
drop function if exists public.claim_tenant_invite(text);
drop function if exists public.get_tenant_invite_preview(text);
drop function if exists public.create_tenant_invite(uuid, text, text, timestamptz);

update public.tenant_invites
set status = 'revoked'
where status = 'pending';

revoke all on public.tenant_invites from anon, authenticated;

drop policy if exists tenant_read_invites on public.tenant_invites;
drop policy if exists tenant_write_invites on public.tenant_invites;

delete from public.email_templates where template_key = 'tenant_invite';

comment on table public.tenant_invites is
  'DEPRECATED: church invite tokens replaced by self-service access requests. Table kept for erase_user_account/export_user_account until functions are rewritten.';
