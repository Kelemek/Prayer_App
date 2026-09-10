-- Kill global admin_settings as a cross-tenant church config path.
-- Church-scoped knobs live on tenant_settings. admin_settings remains the
-- super-admin-only platform singleton (GitHub feedback repo, app test account).

-- ---------------------------------------------------------------------------
-- 1) Missing tenant_settings columns + backfill from admin_settings id=1
-- ---------------------------------------------------------------------------
alter table public.tenant_settings
  add column if not exists church_website_url text,
  add column if not exists rich_text_editors_enabled boolean not null default true,
  add column if not exists require_email_verification boolean not null default false,
  add column if not exists verification_code_expiry_minutes integer not null default 15;

alter table public.tenant_settings
  drop constraint if exists tenant_settings_verification_code_expiry_minutes_range;

alter table public.tenant_settings
  add constraint tenant_settings_verification_code_expiry_minutes_range
  check (
    verification_code_expiry_minutes >= 5
    and verification_code_expiry_minutes <= 60
  );

comment on column public.tenant_settings.church_website_url is
  'Optional URL for the church header logo/title link.';
comment on column public.tenant_settings.rich_text_editors_enabled is
  'When false, prayer/update forms use plain text instead of the rich editor.';
comment on column public.tenant_settings.require_email_verification is
  'When true, this tenant requires an email OTP before sensitive member actions.';
comment on column public.tenant_settings.verification_code_expiry_minutes is
  'OTP lifetime in minutes for this tenant (5–60).';

-- Backfill church-scoped fields that already exist on admin_settings.
update public.tenant_settings ts
set
  require_site_login = coalesce(a.require_site_login, ts.require_site_login),
  deletions_allowed = coalesce(a.deletions_allowed, ts.deletions_allowed),
  updates_allowed = coalesce(a.updates_allowed, ts.updates_allowed),
  require_email_verification = coalesce(a.require_email_verification, ts.require_email_verification),
  verification_code_expiry_minutes = coalesce(
    a.verification_code_expiry_minutes,
    ts.verification_code_expiry_minutes
  )
from public.admin_settings a
where a.id = 1;

-- rich_text_editors_enabled was added outside tracked migrations on some DBs.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_settings'
      and column_name = 'rich_text_editors_enabled'
  ) then
    execute $sql$
      update public.tenant_settings ts
      set rich_text_editors_enabled = coalesce(a.rich_text_editors_enabled, ts.rich_text_editors_enabled)
      from public.admin_settings a
      where a.id = 1
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_settings'
      and column_name = 'church_website_url'
  ) then
    execute $sql$
      update public.tenant_settings ts
      set church_website_url = coalesce(nullif(trim(a.church_website_url), ''), ts.church_website_url)
      from public.admin_settings a
      where a.id = 1
    $sql$;
  end if;
end
$$;

-- New churches should get tenant_settings column defaults, not a copy of the
-- platform singleton (that was the remaining admin_settings write leak on insert).
create or replace function public.seed_tenant_email_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  def_id uuid;
begin
  insert into public.tenant_settings (tenant_id)
  values (new.id)
  on conflict (tenant_id) do nothing;

  select id into def_id from public.tenants where slug = 'default-tenant' limit 1;
  if def_id is null or new.id = def_id then
    return new;
  end if;

  insert into public.email_templates (
    tenant_id,
    template_key,
    name,
    subject,
    html_body,
    text_body,
    description,
    created_at,
    updated_at
  )
  select
    new.id,
    src.template_key,
    src.name,
    src.subject,
    src.html_body,
    src.text_body,
    src.description,
    src.created_at,
    src.updated_at
  from public.email_templates src
  where src.tenant_id = def_id
    and not exists (
      select 1
      from public.email_templates existing
      where existing.tenant_id = new.id
        and existing.template_key = src.template_key
    );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Branding RPCs: include church_website_url
-- ---------------------------------------------------------------------------
drop function if exists public.get_tenant_branding_settings(uuid, text);
drop function if exists public.update_tenant_branding_settings(uuid, text, boolean, text, text, text);
drop function if exists public.get_public_tenant_branding(uuid);

create or replace function public.get_tenant_branding_settings(
  p_tenant_id uuid,
  p_email text default null
)
returns table (
  app_title text,
  church_website_url text,
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
    ts.church_website_url,
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
  p_church_website_url text default null,
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
    church_website_url,
    updated_at
  )
  values (
    p_tenant_id,
    p_app_title,
    coalesce(p_use_logo, false),
    p_light_mode_logo_blob,
    p_dark_mode_logo_blob,
    nullif(trim(coalesce(p_church_website_url, '')), ''),
    now()
  )
  on conflict (tenant_id) do update set
    app_title = excluded.app_title,
    use_logo = excluded.use_logo,
    light_mode_logo_blob = excluded.light_mode_logo_blob,
    dark_mode_logo_blob = excluded.dark_mode_logo_blob,
    church_website_url = excluded.church_website_url,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.get_public_tenant_branding(p_tenant_id uuid)
returns table (
  app_title text,
  church_website_url text,
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
    ts.church_website_url,
    ts.use_logo,
    ts.light_mode_logo_blob,
    ts.dark_mode_logo_blob,
    ts.branding_last_modified
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
$$;

grant execute on function public.get_tenant_branding_settings(uuid, text) to anon, authenticated;
grant execute on function public.update_tenant_branding_settings(uuid, text, boolean, text, text, text, text) to anon, authenticated;
grant execute on function public.get_public_tenant_branding(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Lock admin_settings to platform super-admin writes
-- ---------------------------------------------------------------------------
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
    or old.church_website_url is distinct from new.church_website_url
  ) then
    new.branding_last_modified = now();
  end if;
  return new;
end;
$$;

comment on table public.admin_settings is
  'Platform-global singleton (id=1). Super-admin only writes. Church config lives on tenant_settings. Remaining columns: GitHub feedback repo + app test account.';

drop policy if exists "Allow all inserts on admin_settings" on public.admin_settings;
drop policy if exists "Allow all updates on admin_settings" on public.admin_settings;
drop policy if exists "Allow public reads on admin_settings" on public.admin_settings;
drop policy if exists "Authenticated users can insert admin settings" on public.admin_settings;
drop policy if exists "Authenticated users can read admin settings" on public.admin_settings;
drop policy if exists "Authenticated users can update admin settings" on public.admin_settings;
drop policy if exists authenticated_all_access on public.admin_settings;
drop policy if exists public_read_access on public.admin_settings;
drop policy if exists admin_settings_select_authenticated on public.admin_settings;
drop policy if exists admin_settings_write_super_admin on public.admin_settings;

-- Authenticated members may read platform knobs (GitHub enabled flag, test account
-- exclusion). Writes are super_admin only so Church A cannot mutate Church B or
-- the shared SaaS GitHub/test-account config.
create policy admin_settings_select_authenticated
  on public.admin_settings
  for select
  to anon, authenticated
  using (id = 1);

create policy admin_settings_write_super_admin
  on public.admin_settings
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

revoke insert, update, delete, truncate on public.admin_settings from anon;
grant select on public.admin_settings to anon, authenticated;
grant insert, update on public.admin_settings to authenticated;
