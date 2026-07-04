-- Finalize merge: app reads/writes tenant_memberships directly.
-- Drop email_subscribers compatibility view, triggers, and legacy table.

-- create_tenant_for_user: remove email_subscribers view check (tenant_memberships only)
drop function if exists public.create_tenant_for_user(text, text, public.plan_tier, public.plan_status, text);

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
        select 1 from public.tenant_memberships tm
        where tm.user_email = v_p_email and tm.role = 'tenant_admin'
      )
      or exists (
        select 1 from public.global_roles gr
        where gr.user_email = v_p_email and gr.role = 'super_admin'
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

-- RLS policies still referencing email_subscribers_legacy after table rename
drop policy if exists "Admins can see all personal prayer updates" on public.personal_prayer_updates;
create policy "Admins can see all personal prayer updates"
  on public.personal_prayer_updates
  as permissive
  for select
  to public
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.personal_prayers pp
      where pp.id = personal_prayer_updates.personal_prayer_id
        and (
          public.is_tenant_admin(pp.tenant_id)
          or public.is_super_admin()
        )
    )
  );

drop policy if exists "Admins can see all personal prayers" on public.personal_prayers;
create policy "Admins can see all personal prayers"
  on public.personal_prayers
  as permissive
  for select
  to public
  using (
    auth.role() = 'authenticated'
    and (
      public.is_tenant_admin(tenant_id)
      or public.is_super_admin()
    )
  );

-- Drop compatibility view + INSTEAD OF triggers
drop trigger if exists email_subscribers_instead_of_insert on public.email_subscribers;
drop trigger if exists email_subscribers_instead_of_update on public.email_subscribers;
drop trigger if exists email_subscribers_instead_of_delete on public.email_subscribers;

drop view if exists public.email_subscribers;

drop function if exists public.email_subscribers_view_insert();
drop function if exists public.email_subscribers_view_update();
drop function if exists public.email_subscribers_view_delete();
drop function if exists public.update_email_subscribers_updated_at();

-- Drop renamed legacy table (data already in tenant_memberships)
drop table if exists public.email_subscribers_legacy;
