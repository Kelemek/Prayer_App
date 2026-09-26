-- Accepting a re-sent invite fails when an older accepted row exists for the same tenant + email.

create or replace function public.claim_tenant_invite(p_token text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(public.current_user_email(), '')));
  v_token text := trim(coalesce(p_token, ''));
  v_display_name text := nullif(trim(coalesce(p_display_name, '')), '');
  v_invite public.tenant_invites%rowtype;
begin
  if v_email = '' then
    raise exception 'You must be logged in to claim an invite';
  end if;

  if v_display_name is null then
    raise exception 'Please enter your name';
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

  perform public.upsert_user_subscription_free(v_email, v_display_name);

  insert into public.tenant_memberships (tenant_id, user_email, role, name)
  values (v_invite.tenant_id, v_email, 'member', v_display_name)
  on conflict (tenant_id, user_email) do update
    set name = coalesce(
      nullif(trim(public.tenant_memberships.name), ''),
      excluded.name
    );

  -- (tenant_id, email, status) is unique; drop prior accepted rows before re-accept.
  delete from public.tenant_invites
  where tenant_id = v_invite.tenant_id
    and lower(trim(email)) = v_email
    and status = 'accepted'
    and id <> v_invite.id;

  update public.tenant_invites
  set
    status = 'accepted',
    accepted_at = now()
  where id = v_invite.id;

  return v_invite.tenant_id;
end;
$$;

grant execute on function public.claim_tenant_invite(text, text) to authenticated, service_role;
