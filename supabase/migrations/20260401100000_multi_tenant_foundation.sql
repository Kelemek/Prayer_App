-- Multi-tenant foundation: tenants, memberships, roles, subscriptions,
-- tenant-scoped shared data, and baseline RLS.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_tier') then
    create type public.plan_tier as enum ('free', 'groups', 'churches');
  end if;
  if not exists (select 1 from pg_type where typname = 'plan_status') then
    create type public.plan_status as enum ('active', 'trialing', 'past_due', 'canceled', 'incomplete');
  end if;
  if not exists (select 1 from pg_type where typname = 'tenant_membership_role') then
    create type public.tenant_membership_role as enum ('member', 'leader', 'tenant_admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'global_role') then
    create type public.global_role as enum ('super_admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'tenant_invite_status') then
    create type public.tenant_invite_status as enum ('pending', 'accepted', 'expired', 'revoked');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_source') then
    create type public.subscription_source as enum ('manual', 'imported', 'future_stripe');
  end if;
end
$$;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan_tier public.plan_tier not null default 'free',
  plan_status public.plan_status not null default 'active',
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_email text not null,
  role public.tenant_membership_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_email)
);

create table if not exists public.global_roles (
  id uuid primary key default gen_random_uuid(),
  user_email text not null unique,
  role public.global_role not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  token text not null unique,
  status public.tenant_invite_status not null default 'pending',
  invited_by_email text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, email, status)
);

create table if not exists public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_tier public.plan_tier not null,
  status public.plan_status not null default 'active',
  source public.subscription_source not null default 'manual',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  grace_until timestamptz,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_subscription_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade unique,
  require_site_login boolean not null default true,
  deletions_allowed text not null default 'everyone',
  updates_allowed text not null default 'everyone',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prayers add column if not exists tenant_id uuid;
alter table public.prayer_updates add column if not exists tenant_id uuid;
alter table public.prayer_prompts add column if not exists tenant_id uuid;
alter table public.prayer_types add column if not exists tenant_id uuid;
alter table public.deletion_requests add column if not exists tenant_id uuid;
alter table public.update_deletion_requests add column if not exists tenant_id uuid;
alter table public.account_approval_requests add column if not exists tenant_id uuid;

with default_tenant as (
  insert into public.tenants (name, slug, plan_tier, plan_status, created_by_email)
  values ('Default Tenant', 'default-tenant', 'churches', 'active', null)
  on conflict (slug) do update set updated_at = now()
  returning id
)
insert into public.tenant_settings (tenant_id)
select id from default_tenant
on conflict (tenant_id) do nothing;

with t as (
  select id from public.tenants where slug = 'default-tenant' limit 1
)
update public.prayers p set tenant_id = t.id from t where p.tenant_id is null;
with t as (
  select id from public.tenants where slug = 'default-tenant' limit 1
)
update public.prayer_updates pu
set tenant_id = coalesce(pu.tenant_id, p.tenant_id, t.id)
from public.prayers p, t
where pu.prayer_id = p.id;
with t as (
  select id from public.tenants where slug = 'default-tenant' limit 1
)
update public.prayer_prompts pp set tenant_id = t.id from t where pp.tenant_id is null;
with t as (
  select id from public.tenants where slug = 'default-tenant' limit 1
)
update public.prayer_types pt set tenant_id = t.id from t where pt.tenant_id is null;
with t as (
  select id from public.tenants where slug = 'default-tenant' limit 1
)
update public.deletion_requests dr
set tenant_id = coalesce(dr.tenant_id, p.tenant_id, t.id)
from public.prayers p, t
where dr.prayer_id = p.id;
with t as (
  select id from public.tenants where slug = 'default-tenant' limit 1
)
update public.update_deletion_requests udr
set tenant_id = coalesce(udr.tenant_id, pu.tenant_id, t.id)
from public.prayer_updates pu, t
where udr.update_id = pu.id;
with t as (
  select id from public.tenants where slug = 'default-tenant' limit 1
)
update public.account_approval_requests aar set tenant_id = t.id from t where aar.tenant_id is null;

insert into public.tenant_memberships (tenant_id, user_email, role)
select t.id, lower(es.email), 'tenant_admin'::public.tenant_membership_role
from public.email_subscribers es
join public.tenants t on t.slug = 'default-tenant'
where es.is_admin = true
on conflict (tenant_id, user_email) do nothing;

alter table public.prayers
  alter column tenant_id set not null,
  add constraint prayers_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.prayer_updates
  alter column tenant_id set not null,
  add constraint prayer_updates_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.prayer_prompts
  alter column tenant_id set not null,
  add constraint prayer_prompts_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.prayer_types
  alter column tenant_id set not null,
  add constraint prayer_types_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;

create index if not exists idx_tenant_memberships_user_email on public.tenant_memberships (user_email);
create index if not exists idx_tenant_memberships_tenant_id on public.tenant_memberships (tenant_id);
create index if not exists idx_prayers_tenant_id on public.prayers (tenant_id);
create index if not exists idx_prayer_updates_tenant_id on public.prayer_updates (tenant_id);
create index if not exists idx_prayer_prompts_tenant_id on public.prayer_prompts (tenant_id);
create index if not exists idx_prayer_types_tenant_id on public.prayer_types (tenant_id);
create index if not exists idx_tenant_invites_tenant_id on public.tenant_invites (tenant_id);
create index if not exists idx_tenant_subscriptions_tenant_id on public.tenant_subscriptions (tenant_id);

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', current_setting('request.jwt.claim.email', true), ''));
$$;

create or replace function public.is_super_admin(email_to_check text default null)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.global_roles gr
    where gr.user_email = lower(coalesce(email_to_check, public.current_user_email()))
      and gr.role = 'super_admin'
  );
$$;

create or replace function public.is_tenant_member(tenant_to_check uuid, email_to_check text default null)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = tenant_to_check
      and tm.user_email = lower(coalesce(email_to_check, public.current_user_email()))
  ) or public.is_super_admin(email_to_check);
$$;

create or replace function public.is_tenant_admin(tenant_to_check uuid, email_to_check text default null)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = tenant_to_check
      and tm.user_email = lower(coalesce(email_to_check, public.current_user_email()))
      and tm.role = 'tenant_admin'
  ) or public.is_super_admin(email_to_check);
$$;

create or replace function public.tenant_plan(tenant_to_check uuid)
returns public.plan_tier
language sql
stable
as $$
  select t.plan_tier
  from public.tenants t
  where t.id = tenant_to_check;
$$;

create or replace function public.update_tenant_subscription(
  p_tenant_id uuid,
  p_plan_tier public.plan_tier,
  p_status public.plan_status,
  p_source public.subscription_source default 'manual',
  p_grace_until timestamptz default null,
  p_created_by_email text default null
)
returns public.tenant_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.tenant_subscriptions;
begin
  insert into public.tenant_subscriptions (
    tenant_id, plan_tier, status, source, starts_at, grace_until, created_by_email, updated_at
  )
  values (
    p_tenant_id, p_plan_tier, p_status, p_source, now(), p_grace_until, lower(p_created_by_email), now()
  )
  returning * into v_sub;

  update public.tenants
  set
    plan_tier = p_plan_tier,
    plan_status = p_status,
    updated_at = now()
  where id = p_tenant_id;

  insert into public.tenant_subscription_events (
    tenant_id, event_type, payload, created_by_email
  )
  values (
    p_tenant_id,
    'subscription_updated',
    jsonb_build_object(
      'plan_tier', p_plan_tier,
      'status', p_status,
      'source', p_source,
      'grace_until', p_grace_until
    ),
    lower(p_created_by_email)
  );

  return v_sub;
end;
$$;

create or replace function public.get_tenant_context_by_email(p_email text)
returns table (
  tenant_id uuid,
  user_email text,
  role public.tenant_membership_role,
  tenant jsonb,
  is_super_admin boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
  super_admin boolean := false;
begin
  if normalized_email = '' then
    return;
  end if;

  select exists (
    select 1
    from public.global_roles gr
    where gr.user_email = normalized_email
      and gr.role = 'super_admin'
  ) into super_admin;

  return query
  select
    tm.tenant_id,
    tm.user_email,
    tm.role,
    jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'slug', t.slug,
      'plan_tier', t.plan_tier,
      'plan_status', t.plan_status
    ) as tenant,
    super_admin as is_super_admin
  from public.tenant_memberships tm
  join public.tenants t on t.id = tm.tenant_id
  where lower(tm.user_email) = normalized_email;
end;
$$;

create or replace function public.create_tenant_invite(
  p_tenant_id uuid,
  p_invitee_email text,
  p_invited_by_email text,
  p_expires_at timestamptz default (now() + interval '7 days')
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_invitee text := lower(trim(coalesce(p_invitee_email, '')));
  normalized_inviter text := lower(trim(coalesce(p_invited_by_email, '')));
  invite_token text := gen_random_uuid()::text;
begin
  if normalized_invitee = '' or normalized_inviter = '' then
    raise exception 'Invitee and inviter emails are required';
  end if;

  if not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_email = normalized_inviter
      and tm.role = 'tenant_admin'
  ) and not exists (
    select 1
    from public.global_roles gr
    where gr.user_email = normalized_inviter
      and gr.role = 'super_admin'
  ) then
    raise exception 'Only tenant admins or super admins can create invites';
  end if;

  insert into public.tenant_invites (
    tenant_id,
    email,
    token,
    invited_by_email,
    expires_at
  ) values (
    p_tenant_id,
    normalized_invitee,
    invite_token,
    normalized_inviter,
    p_expires_at
  );

  return invite_token;
end;
$$;

grant execute on function public.current_user_email() to anon, authenticated, service_role;
grant execute on function public.is_super_admin(text) to anon, authenticated, service_role;
grant execute on function public.is_tenant_member(uuid, text) to anon, authenticated, service_role;
grant execute on function public.is_tenant_admin(uuid, text) to anon, authenticated, service_role;
grant execute on function public.tenant_plan(uuid) to anon, authenticated, service_role;
grant execute on function public.update_tenant_subscription(uuid, public.plan_tier, public.plan_status, public.subscription_source, timestamptz, text) to service_role;
grant execute on function public.get_tenant_context_by_email(text) to anon, authenticated, service_role;
grant execute on function public.create_tenant_invite(uuid, text, text, timestamptz) to anon, authenticated, service_role;

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_invites enable row level security;
alter table public.global_roles enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.tenant_subscription_events enable row level security;
alter table public.tenant_settings enable row level security;

create policy tenant_read_memberships on public.tenant_memberships
for select using (
  lower(user_email) = public.current_user_email()
  or public.is_super_admin()
);

create policy tenant_insert_memberships on public.tenant_memberships
for insert with check (public.is_tenant_admin(tenant_id) or public.is_super_admin());

create policy tenant_update_memberships on public.tenant_memberships
for update using (public.is_tenant_admin(tenant_id) or public.is_super_admin())
with check (public.is_tenant_admin(tenant_id) or public.is_super_admin());

create policy tenant_delete_memberships on public.tenant_memberships
for delete using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

create policy tenant_read_tenants on public.tenants
for select using (
  public.is_tenant_member(id)
  or public.is_super_admin()
);

create policy tenant_manage_tenants on public.tenants
for update using (public.is_tenant_admin(id))
with check (public.is_tenant_admin(id));

create policy tenant_read_invites on public.tenant_invites
for select using (
  public.is_tenant_admin(tenant_id)
  or lower(email) = public.current_user_email()
  or public.is_super_admin()
);

create policy tenant_write_invites on public.tenant_invites
for all using (public.is_tenant_admin(tenant_id) or public.is_super_admin())
with check (public.is_tenant_admin(tenant_id) or public.is_super_admin());

create policy tenant_read_subscriptions on public.tenant_subscriptions
for select using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

create policy tenant_write_subscriptions on public.tenant_subscriptions
for all using (public.is_super_admin())
with check (public.is_super_admin());

create policy tenant_read_subscription_events on public.tenant_subscription_events
for select using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

create policy tenant_write_subscription_events on public.tenant_subscription_events
for all using (public.is_super_admin())
with check (public.is_super_admin());

create policy tenant_read_settings on public.tenant_settings
for select using (public.is_tenant_member(tenant_id) or public.is_super_admin());

create policy tenant_write_settings on public.tenant_settings
for all using (public.is_tenant_admin(tenant_id) or public.is_super_admin())
with check (public.is_tenant_admin(tenant_id) or public.is_super_admin());

create policy global_roles_self_read on public.global_roles
for select using (
  lower(user_email) = public.current_user_email()
  or public.is_super_admin()
);

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('prayers', 'prayer_updates', 'prayer_prompts', 'prayer_types')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end
$$;

create policy tenant_read_prayers on public.prayers
for select using (
  public.is_tenant_member(tenant_id)
  and public.tenant_plan(tenant_id) in ('groups', 'churches')
);

create policy tenant_insert_prayers on public.prayers
for insert with check (
  public.is_tenant_member(tenant_id)
  and public.tenant_plan(tenant_id) in ('groups', 'churches')
);

create policy tenant_update_prayers on public.prayers
for update using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy tenant_delete_prayers on public.prayers
for delete using (public.is_tenant_admin(tenant_id));

create policy tenant_read_prayer_updates on public.prayer_updates
for select using (
  public.is_tenant_member(tenant_id)
  and public.tenant_plan(tenant_id) in ('groups', 'churches')
);

create policy tenant_insert_prayer_updates on public.prayer_updates
for insert with check (
  public.is_tenant_member(tenant_id)
  and public.tenant_plan(tenant_id) in ('groups', 'churches')
);

create policy tenant_update_prayer_updates on public.prayer_updates
for update using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy tenant_delete_prayer_updates on public.prayer_updates
for delete using (public.is_tenant_admin(tenant_id));

create policy tenant_read_prayer_prompts on public.prayer_prompts
for select using (public.is_tenant_member(tenant_id));

create policy tenant_write_prayer_prompts on public.prayer_prompts
for all using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy tenant_read_prayer_types on public.prayer_types
for select using (public.is_tenant_member(tenant_id));

create policy tenant_write_prayer_types on public.prayer_types
for all using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create or replace function public.is_admin(user_email text)
returns boolean
language sql
stable
as $$
  select public.is_super_admin(user_email)
    or exists (
      select 1
      from public.tenant_memberships tm
      where tm.user_email = lower(user_email)
        and tm.role = 'tenant_admin'
    );
$$;
