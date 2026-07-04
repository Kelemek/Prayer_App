-- Scope super-admin prayer listing to a selected tenant (tenant switcher / impersonation).
-- Replaces the all-tenants variant from 20260415120000.

drop function if exists public.list_approved_prayers_for_super_admin(text);
drop function if exists public.list_approved_prayer_updates_for_super_admin(text, uuid[]);

create or replace function public.list_approved_prayers_for_super_admin(
  p_actor_email text,
  p_tenant_id uuid
)
returns setof public.prayers
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_actor_email, '')));
begin
  if v_email = '' or p_tenant_id is null then
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
  where p.tenant_id = p_tenant_id
    and p.approval_status = 'approved'
    and public.tenant_plan(p.tenant_id) in ('groups', 'churches')
  order by p.created_at desc;
end;
$$;

create or replace function public.list_approved_prayer_updates_for_super_admin(
  p_actor_email text,
  p_tenant_id uuid,
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
  if v_email = '' or p_tenant_id is null or p_prayer_ids is null or cardinality(p_prayer_ids) = 0 then
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
  where pu.tenant_id = p_tenant_id
    and pu.prayer_id = any (p_prayer_ids)
    and pu.approval_status = 'approved'
    and public.tenant_plan(pu.tenant_id) in ('groups', 'churches')
  order by pu.created_at desc;
end;
$$;

grant execute on function public.list_approved_prayers_for_super_admin(text, uuid) to anon, authenticated;
grant execute on function public.list_approved_prayer_updates_for_super_admin(text, uuid, uuid[]) to anon, authenticated;
