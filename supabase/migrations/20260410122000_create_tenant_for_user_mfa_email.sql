-- MFA admin sessions use localStorage email with no Supabase JWT, so auth.uid() / JWT claims are empty.
-- Allow create_tenant_for_user to accept p_email when the caller is anon or has no session identity,
-- after the same email-based checks used elsewhere for MFA (admin list, super admin, or tenant admin).

drop function if exists public.create_tenant_for_user(text, text, public.plan_tier, public.plan_status);

create or replace function public.create_tenant_for_user(
  p_name text,
  p_slug text,
  p_plan_tier public.plan_tier,
  p_plan_status public.plan_status default 'active',
  p_email text default null
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
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
begin
  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  if v_from_auth is not null and v_from_auth != '' then
    v_email := v_from_auth;
  elsif v_p_email != '' then
    if not (
      exists (
        select 1 from public.email_subscribers es
        where lower(es.email) = v_p_email and es.is_admin = true
      )
      or exists (
        select 1 from public.global_roles gr
        where gr.user_email = v_p_email and gr.role = 'super_admin'
      )
      or exists (
        select 1 from public.tenant_memberships tm
        where tm.user_email = v_p_email and tm.role = 'tenant_admin'
      )
    ) then
      raise exception 'Not authorized to create a tenant';
    end if;
    v_email := v_p_email;
  else
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

grant execute on function public.create_tenant_for_user(text, text, public.plan_tier, public.plan_status, text) to anon, authenticated;
