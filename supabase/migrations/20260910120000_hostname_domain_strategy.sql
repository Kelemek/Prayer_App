-- Hostname / domain strategy: reserved tenant slugs + custom_domains stub.
-- Keep reserved slug list in sync with src/app/lib/tenant-slug.ts

-- ----- Reserved slug enforcement -----

create or replace function public.is_reserved_tenant_slug(p_slug text)
returns boolean
language sql
immutable
as $$
  select lower(trim(p_slug)) in (
    'www', 'app', 'api', 'admin', 'mail', 'prayer',
    'ftp', 'cdn', 'static', 'auth', 'login', 'status', 'smtp',
    'staging', 'preview', 'offline', 'personal', 'platform'
  );
$$;

create or replace function public.assert_tenant_slug_allowed(p_slug text)
returns void
language plpgsql
immutable
as $$
declare
  v_slug text;
begin
  v_slug := lower(regexp_replace(trim(p_slug), '\s+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
  if v_slug = '' then
    raise exception 'Invalid slug';
  end if;
  if public.is_reserved_tenant_slug(v_slug) then
    raise exception 'Reserved slug';
  end if;
  if v_slug !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' then
    raise exception 'Invalid slug format';
  end if;
end;
$$;

create or replace function public.enforce_tenant_slug_allowed()
returns trigger
language plpgsql
as $$
begin
  perform public.assert_tenant_slug_allowed(new.slug);
  return new;
end;
$$;

drop trigger if exists tenants_slug_reserved_check on public.tenants;
create trigger tenants_slug_reserved_check
before insert or update of slug on public.tenants
for each row execute function public.enforce_tenant_slug_allowed();

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
  perform public.assert_tenant_slug_allowed(v_slug);

  insert into public.tenants (name, slug, plan_tier, plan_status, created_by_email)
  values (trim(p_name), v_slug, p_plan_tier, p_plan_status, v_email)
  returning * into v_tenant;

  insert into public.tenant_memberships (tenant_id, user_email, role)
  values (v_tenant.id, v_email, 'tenant_admin');

  return v_tenant;
end;
$$;

grant execute on function public.create_tenant_for_user(text, text, public.plan_tier, public.plan_status, text) to anon, authenticated;

-- ----- Custom domains stub (future Host -> tenant_id) -----

create table if not exists public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  host text not null unique,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists custom_domains_tenant_id_idx
  on public.custom_domains (tenant_id);

alter table public.custom_domains enable row level security;

drop policy if exists custom_domains_super_admin_read on public.custom_domains;
create policy custom_domains_super_admin_read on public.custom_domains
for select using (public.is_super_admin());

comment on table public.custom_domains is
  'Maps verified church-owned hostnames to tenants for future custom-domain routing.';
