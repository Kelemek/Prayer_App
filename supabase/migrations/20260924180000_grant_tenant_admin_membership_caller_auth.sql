-- grant_tenant_admin_membership: do not treat p_email as caller identity (privilege escalation).

create or replace function public.grant_tenant_admin_membership(
  p_tenant_id uuid,
  p_invitee_email text,
  p_invitee_name text,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text;
  v_from_auth text;
  v_jwt_email text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
  v_invitee text := lower(trim(coalesce(p_invitee_email, '')));
  v_name text := trim(coalesce(p_invitee_name, ''));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  if v_invitee = '' or v_name = '' then
    raise exception 'Email and name are required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  v_jwt_email := nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '');

  if v_from_auth is not null and v_from_auth != '' then
    v_caller := v_from_auth;
  else
    v_caller := v_jwt_email;
  end if;

  if v_caller is null or v_caller = '' then
    raise exception 'Not authenticated';
  end if;

  if v_p_email != '' and v_p_email != v_caller then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_caller) or public.is_super_admin(v_caller)) then
    raise exception 'Not authorized for tenant';
  end if;

  if public.is_super_admin(v_invitee) then
    raise exception 'Super admins are managed at the platform level and are not listed here';
  end if;

  if exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_email = v_invitee
      and tm.role = 'tenant_admin'
  ) then
    raise exception 'This email is already an admin for this tenant';
  end if;

  insert into public.tenant_memberships (
    tenant_id,
    user_email,
    name,
    role,
    is_active,
    receive_admin_push,
    receive_admin_emails
  )
  values (
    p_tenant_id,
    v_invitee,
    v_name,
    'tenant_admin',
    true,
    true,
    true
  )
  on conflict (tenant_id, user_email) do update set
    name = excluded.name,
    role = 'tenant_admin',
    is_active = true,
    receive_admin_push = true,
    receive_admin_emails = coalesce(tenant_memberships.receive_admin_emails, true),
    updated_at = now();
end;
$$;
