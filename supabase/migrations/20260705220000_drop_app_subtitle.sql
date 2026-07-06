-- Remove unused app_subtitle branding field from schema and RPCs.

create or replace function public.update_tenant_settings_branding_last_modified()
returns trigger
language plpgsql
as $$
begin
  if (
    old.use_logo is distinct from new.use_logo
    or old.light_mode_logo_blob is distinct from new.light_mode_logo_blob
    or old.dark_mode_logo_blob is distinct from new.dark_mode_logo_blob
    or old.app_title is distinct from new.app_title
  ) then
    new.branding_last_modified = now();
  end if;
  return new;
end;
$$;

create or replace function public.update_branding_last_modified()
returns trigger
language plpgsql
as $$
begin
  if (
    old.use_logo is distinct from new.use_logo
    or old.light_mode_logo_blob is distinct from new.light_mode_logo_blob
    or old.dark_mode_logo_blob is distinct from new.dark_mode_logo_blob
    or old.app_title is distinct from new.app_title
  ) then
    new.branding_last_modified = now();
  end if;
  return new;
end;
$$;

drop function if exists public.get_tenant_branding_settings(uuid, text);
drop function if exists public.update_tenant_branding_settings(uuid, text, text, boolean, text, text, text);
drop function if exists public.get_public_tenant_branding(uuid);

create or replace function public.get_tenant_branding_settings(
  p_tenant_id uuid,
  p_email text default null
)
returns table (
  app_title text,
  use_logo boolean,
  light_mode_logo_blob text,
  dark_mode_logo_blob text,
  branding_last_modified timestamptz
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
    ts.app_title,
    ts.use_logo,
    ts.light_mode_logo_blob,
    ts.dark_mode_logo_blob,
    ts.branding_last_modified
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
end;
$$;

create or replace function public.update_tenant_branding_settings(
  p_tenant_id uuid,
  p_app_title text,
  p_use_logo boolean,
  p_light_mode_logo_blob text,
  p_dark_mode_logo_blob text,
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
    app_title,
    use_logo,
    light_mode_logo_blob,
    dark_mode_logo_blob,
    updated_at
  )
  values (
    p_tenant_id,
    p_app_title,
    coalesce(p_use_logo, false),
    p_light_mode_logo_blob,
    p_dark_mode_logo_blob,
    now()
  )
  on conflict (tenant_id) do update set
    app_title = excluded.app_title,
    use_logo = excluded.use_logo,
    light_mode_logo_blob = excluded.light_mode_logo_blob,
    dark_mode_logo_blob = excluded.dark_mode_logo_blob,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.get_public_tenant_branding(p_tenant_id uuid)
returns table (
  app_title text,
  use_logo boolean,
  light_mode_logo_blob text,
  dark_mode_logo_blob text,
  branding_last_modified timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ts.app_title,
    ts.use_logo,
    ts.light_mode_logo_blob,
    ts.dark_mode_logo_blob,
    ts.branding_last_modified
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
$$;

grant execute on function public.get_tenant_branding_settings(uuid, text) to anon, authenticated;
grant execute on function public.update_tenant_branding_settings(uuid, text, boolean, text, text, text) to anon, authenticated;
grant execute on function public.get_public_tenant_branding(uuid) to anon, authenticated;

alter table public.tenant_settings
  drop column if exists app_subtitle;

alter table public.admin_settings
  drop column if exists app_subtitle;
