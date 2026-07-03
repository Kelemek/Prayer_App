-- Create tenant + tenant_admin membership in one transaction, bypassing RLS.
-- Direct INSERT into public.tenants fails when tenant_insert RLS policies are missing or mis-synced;
-- this RPC uses SECURITY DEFINER so deployments only need this function + grant.

create or replace function public.create_tenant_for_user(
  p_name text,
  p_slug text,
  p_plan_tier public.plan_tier,
  p_plan_status public.plan_status default 'active'
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_tenant public.tenants;
  v_slug text;
begin
  select lower(trim(u.email)) into v_email
  from auth.users u
  where u.id = auth.uid();

  if v_email is null or v_email = '' then
    v_email := nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '');
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  v_slug := lower(regexp_replace(trim(p_slug), '\s+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
  if v_slug = '' then
    raise exception 'Invalid slug';
  end if;

  insert into public.tenants (name, slug, plan_tier, plan_status, created_by_email)
  values (trim(p_name), v_slug, p_plan_tier, p_plan_status, v_email)
  returning * into v_tenant;

  insert into public.tenant_memberships (tenant_id, user_email, role)
  values (v_tenant.id, v_email, 'tenant_admin');

  return v_tenant;
end;
$$;

grant execute on function public.create_tenant_for_user(text, text, public.plan_tier, public.plan_status) to authenticated;
