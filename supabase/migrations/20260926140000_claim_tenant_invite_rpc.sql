-- Allow invitees to claim pending invites without tenant-admin RLS on memberships / invite rows.

create or replace function public.claim_tenant_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(public.current_user_email(), '')));
  v_token text := trim(coalesce(p_token, ''));
  v_invite public.tenant_invites%rowtype;
begin
  if v_email = '' then
    raise exception 'You must be logged in to claim an invite';
  end if;

  if v_token = '' then
    raise exception 'Invite not found or already used';
  end if;

  select *
  into v_invite
  from public.tenant_invites i
  where i.token = v_token
    and i.status = 'pending'
  limit 1
  for update;

  if not found then
    raise exception 'Invite not found or already used';
  end if;

  if lower(trim(v_invite.email)) <> v_email then
    raise exception 'Invite email does not match this user';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Invite has expired';
  end if;

  insert into public.tenant_memberships (tenant_id, user_email, role)
  values (v_invite.tenant_id, v_email, 'member')
  on conflict (tenant_id, user_email) do nothing;

  update public.tenant_invites
  set
    status = 'accepted',
    accepted_at = now()
  where id = v_invite.id;

  return v_invite.tenant_id;
end;
$$;

grant execute on function public.claim_tenant_invite(text) to authenticated, service_role;
