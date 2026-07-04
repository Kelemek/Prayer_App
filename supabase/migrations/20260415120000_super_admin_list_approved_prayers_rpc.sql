-- Super admins can list approved shared prayers across all tenants.
-- MFA sessions have no JWT email in Postgres, so use the same email-trust pattern as
-- get_tenant_context_by_email / get_all_tenants_for_email.

create or replace function public.list_approved_prayers_for_super_admin(p_actor_email text)
returns setof public.prayers
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_actor_email, '')));
begin
  if v_email = '' then
    return;
  end if;

  if not exists (
    select 1
    from public.global_roles gr
    where gr.user_email = v_email
      and gr.role = 'super_admin'
  ) then
    return;
  end if;

  return query
  select p.*
  from public.prayers p
  where p.approval_status = 'approved'
    and p.tenant_id is not null
    and public.tenant_plan(p.tenant_id) in ('groups', 'churches')
  order by p.created_at desc;
end;
$$;

create or replace function public.list_approved_prayer_updates_for_super_admin(
  p_actor_email text,
  p_prayer_ids uuid[]
)
returns setof public.prayer_updates
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_actor_email, '')));
begin
  if v_email = '' or p_prayer_ids is null or cardinality(p_prayer_ids) = 0 then
    return;
  end if;

  if not exists (
    select 1
    from public.global_roles gr
    where gr.user_email = v_email
      and gr.role = 'super_admin'
  ) then
    return;
  end if;

  return query
  select pu.*
  from public.prayer_updates pu
  where pu.prayer_id = any (p_prayer_ids)
    and pu.approval_status = 'approved'
    and pu.tenant_id is not null
    and public.tenant_plan(pu.tenant_id) in ('groups', 'churches')
  order by pu.created_at desc;
end;
$$;

grant execute on function public.list_approved_prayers_for_super_admin(text) to anon, authenticated;
grant execute on function public.list_approved_prayer_updates_for_super_admin(text, uuid[]) to anon, authenticated;
