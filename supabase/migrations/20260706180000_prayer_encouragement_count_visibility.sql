-- Prayed-for count visibility: requester+admins only (default) vs all users.

alter table public.tenant_settings
  add column if not exists prayer_encouragement_count_visible_to_all boolean not null default false;

alter table public.admin_settings
  add column if not exists prayer_encouragement_count_visible_to_all boolean not null default false;

drop function if exists public.get_tenant_prayer_encouragement_settings(uuid, text);

create or replace function public.get_tenant_prayer_encouragement_settings(
  p_tenant_id uuid,
  p_email text default null
)
returns table (
  prayer_encouragement_enabled boolean,
  prayer_encouragement_cooldown_hours integer,
  prayer_encouragement_count_visible_to_all boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  if v_p_email != ''
     and (public.is_tenant_admin(p_tenant_id, v_p_email) or public.is_super_admin(v_p_email)) then
    v_email := v_p_email;
  elsif v_from_auth is not null and v_from_auth != '' then
    v_email := v_from_auth;
  elsif v_p_email != '' then
    v_email := v_p_email;
  else
    v_email := nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '');
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  return query
  select
    ts.prayer_encouragement_enabled,
    ts.prayer_encouragement_cooldown_hours,
    ts.prayer_encouragement_count_visible_to_all
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
end;
$$;

drop function if exists public.update_tenant_prayer_encouragement_settings(uuid, boolean, integer, text);

create or replace function public.update_tenant_prayer_encouragement_settings(
  p_tenant_id uuid,
  p_prayer_encouragement_enabled boolean,
  p_prayer_encouragement_cooldown_hours integer,
  p_prayer_encouragement_count_visible_to_all boolean,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  if v_p_email != ''
     and (public.is_tenant_admin(p_tenant_id, v_p_email) or public.is_super_admin(v_p_email)) then
    v_email := v_p_email;
  elsif v_from_auth is not null and v_from_auth != '' then
    v_email := v_from_auth;
  elsif v_p_email != '' then
    v_email := v_p_email;
  else
    v_email := nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '');
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  insert into public.tenant_settings (
    tenant_id,
    prayer_encouragement_enabled,
    prayer_encouragement_cooldown_hours,
    prayer_encouragement_count_visible_to_all,
    updated_at
  )
  values (
    p_tenant_id,
    coalesce(p_prayer_encouragement_enabled, false),
    greatest(1, least(168, coalesce(p_prayer_encouragement_cooldown_hours, 4))),
    coalesce(p_prayer_encouragement_count_visible_to_all, false),
    now()
  )
  on conflict (tenant_id) do update set
    prayer_encouragement_enabled = excluded.prayer_encouragement_enabled,
    prayer_encouragement_cooldown_hours = excluded.prayer_encouragement_cooldown_hours,
    prayer_encouragement_count_visible_to_all = excluded.prayer_encouragement_count_visible_to_all,
    updated_at = excluded.updated_at;
end;
$$;

drop function if exists public.get_public_tenant_prayer_encouragement(uuid);

create or replace function public.get_public_tenant_prayer_encouragement(p_tenant_id uuid)
returns table (
  prayer_encouragement_enabled boolean,
  prayer_encouragement_cooldown_hours integer,
  prayer_encouragement_count_visible_to_all boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ts.prayer_encouragement_enabled,
    ts.prayer_encouragement_cooldown_hours,
    ts.prayer_encouragement_count_visible_to_all
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
$$;

grant execute on function public.get_tenant_prayer_encouragement_settings(uuid, text) to anon, authenticated;
grant execute on function public.update_tenant_prayer_encouragement_settings(uuid, boolean, integer, boolean, text) to anon, authenticated;
grant execute on function public.get_public_tenant_prayer_encouragement(uuid) to anon, authenticated;
