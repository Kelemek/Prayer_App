-- Free / Pro / Church tier alignment: user subscriptions, platform limits, practice modes.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.user_subscriptions (
  user_email text primary key,
  plan_tier text not null default 'free'
    check (plan_tier in ('free', 'pro')),
  plan_status public.plan_status not null default 'active',
  source public.subscription_source not null default 'manual',
  display_name text,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_subscriptions_plan
  on public.user_subscriptions (plan_tier, plan_status);

create table if not exists public.platform_plan_limits (
  plan_tier text primary key
    check (plan_tier in ('free', 'pro', 'churches')),
  max_groups_owned integer not null check (max_groups_owned >= 0),
  max_members_per_group integer not null check (max_members_per_group >= 1),
  updated_at timestamptz not null default now(),
  updated_by_email text
);

insert into public.platform_plan_limits (plan_tier, max_groups_owned, max_members_per_group)
values
  ('free', 1, 5),
  ('pro', 10, 25),
  ('churches', 25, 100)
on conflict (plan_tier) do nothing;

create table if not exists public.platform_plan_practice_modes (
  plan_tier text not null
    check (plan_tier in ('free', 'pro', 'churches')),
  practice_mode text not null
    check (practice_mode in ('type', 'word', 'reorder', 'firstLetters', 'recite')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by_email text,
  primary key (plan_tier, practice_mode)
);

insert into public.platform_plan_practice_modes (plan_tier, practice_mode, enabled)
select v.plan_tier, v.practice_mode, v.enabled
from (
  values
    ('free', 'type', true),
    ('free', 'firstLetters', true),
    ('free', 'word', true),
    ('free', 'reorder', true),
    ('free', 'recite', false),
    ('pro', 'type', true),
    ('pro', 'firstLetters', true),
    ('pro', 'word', true),
    ('pro', 'reorder', true),
    ('pro', 'recite', true),
    ('churches', 'type', true),
    ('churches', 'firstLetters', true),
    ('churches', 'word', true),
    ('churches', 'reorder', true),
    ('churches', 'recite', true)
) as v(plan_tier, practice_mode, enabled)
where not exists (
  select 1
  from public.platform_plan_practice_modes existing
  where existing.plan_tier = v.plan_tier
    and existing.practice_mode = v.practice_mode
);

alter table public.user_subscriptions enable row level security;
alter table public.platform_plan_limits enable row level security;
alter table public.platform_plan_practice_modes enable row level security;

drop policy if exists user_subscriptions_select_own on public.user_subscriptions;
create policy user_subscriptions_select_own on public.user_subscriptions
  for select to authenticated
  using (
    lower(user_email) = public.current_user_email()
    or public.is_super_admin()
  );

drop policy if exists user_subscriptions_update_super_admin on public.user_subscriptions;
create policy user_subscriptions_update_super_admin on public.user_subscriptions
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists platform_plan_limits_select_authenticated on public.platform_plan_limits;
create policy platform_plan_limits_select_authenticated on public.platform_plan_limits
  for select to authenticated
  using (true);

drop policy if exists platform_plan_limits_update_super_admin on public.platform_plan_limits;
create policy platform_plan_limits_update_super_admin on public.platform_plan_limits
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists platform_plan_practice_modes_select_authenticated on public.platform_plan_practice_modes;
create policy platform_plan_practice_modes_select_authenticated on public.platform_plan_practice_modes
  for select to authenticated
  using (true);

drop policy if exists platform_plan_practice_modes_update_super_admin on public.platform_plan_practice_modes;
create policy platform_plan_practice_modes_update_super_admin on public.platform_plan_practice_modes
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Tier helpers
-- ---------------------------------------------------------------------------

create or replace function public.user_individual_plan_tier(p_email text default null)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select us.plan_tier
      from public.user_subscriptions us
      where us.user_email = lower(trim(coalesce(p_email, public.current_user_email())))
        and us.plan_status in ('active', 'trialing')
    ),
    'free'
  );
$$;

create or replace function public.user_has_pro(p_email text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_individual_plan_tier(p_email) = 'pro';
$$;

create or replace function public.user_is_church_member(p_email text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.user_email = lower(trim(coalesce(p_email, public.current_user_email())))
      and coalesce(tm.is_active, true) = true
      and coalesce(tm.is_blocked, false) = false
      and t.plan_tier = 'churches'
      and t.plan_status in ('active', 'trialing')
  );
$$;

create or replace function public.tenant_has_churches_plan(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tenant_plan(p_tenant_id) = 'churches';
$$;

create or replace function public.default_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.tenants where slug = 'default-tenant' limit 1;
$$;

create or replace function public.count_owned_prayer_groups(p_email text default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.prayer_group_members m
  where m.user_email = lower(trim(coalesce(p_email, public.current_user_email())))
    and m.role = 'owner'
    and coalesce(m.is_active, true) = true;
$$;

create or replace function public.prayer_group_owner_email(p_group_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.user_email
  from public.prayer_group_members m
  where m.group_id = p_group_id
    and m.role = 'owner'
    and coalesce(m.is_active, true) = true
  order by m.created_at
  limit 1;
$$;

create or replace function public.count_active_prayer_group_members(p_group_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.prayer_group_members m
  where m.group_id = p_group_id
    and coalesce(m.is_active, true) = true;
$$;

create or replace function public.effective_group_limits_for_email(p_email text default null)
returns table (
  max_groups_owned integer,
  max_members_per_group integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, public.current_user_email())));
  v_individual text;
  v_max_groups integer := 0;
  v_max_members integer := 1;
  v_row record;
begin
  v_individual := public.user_individual_plan_tier(v_email);

  for v_row in
    select l.max_groups_owned, l.max_members_per_group
    from public.platform_plan_limits l
    where l.plan_tier = v_individual
       or (l.plan_tier = 'churches' and public.user_is_church_member(v_email))
  loop
    v_max_groups := greatest(v_max_groups, v_row.max_groups_owned);
    v_max_members := greatest(v_max_members, v_row.max_members_per_group);
  end loop;

  if v_max_groups = 0 then
    select l.max_groups_owned, l.max_members_per_group
      into v_max_groups, v_max_members
    from public.platform_plan_limits l
    where l.plan_tier = 'free';
  end if;

  return query select v_max_groups, v_max_members;
end;
$$;

create or replace function public.get_user_group_limits(p_email text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, public.current_user_email())));
  v_max_groups integer;
  v_max_members integer;
  v_owned integer;
begin
  if v_email is null or v_email = '' then
    raise exception 'Email is required';
  end if;

  select l.max_groups_owned, l.max_members_per_group
    into v_max_groups, v_max_members
  from public.effective_group_limits_for_email(v_email) l;

  v_owned := public.count_owned_prayer_groups(v_email);

  return jsonb_build_object(
    'individual_plan_tier', public.user_individual_plan_tier(v_email),
    'is_church_member', public.user_is_church_member(v_email),
    'max_groups_owned', v_max_groups,
    'max_members_per_group', v_max_members,
    'groups_owned', v_owned,
    'can_create_group', v_owned < v_max_groups
  );
end;
$$;

create or replace function public.user_platform_practice_modes(p_email text default null)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  with v_email as (
    select lower(trim(coalesce(p_email, public.current_user_email()))) as email
  ),
  tiers as (
    select public.user_individual_plan_tier((select email from v_email)) as plan_tier
    union
    select 'churches'::text
    where public.user_is_church_member((select email from v_email))
  )
  select distinct ppm.practice_mode
  from public.platform_plan_practice_modes ppm
  join tiers t on t.plan_tier = ppm.plan_tier
  where ppm.enabled = true;
$$;

create or replace function public.get_user_memorization_practice_modes(p_email text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, public.current_user_email())));
  v_modes jsonb;
  v_recite_tenant_ok boolean := true;
begin
  if v_email is null or v_email = '' then
    raise exception 'Email is required';
  end if;

  select coalesce(jsonb_agg(m order by m), '[]'::jsonb)
    into v_modes
  from (
    select m as m
    from public.user_platform_practice_modes(v_email) m
    where m <> 'recite'
    union all
    select 'recite'
    where exists (
      select 1 from public.user_platform_practice_modes(v_email) pm where pm = 'recite'
    )
    and (
      not public.user_is_church_member(v_email)
      or exists (
        select 1
        from public.tenant_memberships tm
        join public.tenants t on t.id = tm.tenant_id
        join public.tenant_settings ts on ts.tenant_id = t.id
        where tm.user_email = v_email
          and coalesce(tm.is_active, true) = true
          and t.plan_tier = 'churches'
          and t.plan_status in ('active', 'trialing')
          and ts.memorization_recite_enabled = true
      )
    )
  ) s;

  return jsonb_build_object(
    'individual_plan_tier', public.user_individual_plan_tier(v_email),
    'is_church_member', public.user_is_church_member(v_email),
    'practice_modes', v_modes
  );
end;
$$;

create or replace function public.user_practice_mode_allowed(
  p_mode text,
  p_email text default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_modes jsonb;
begin
  v_payload := public.get_user_memorization_practice_modes(p_email);
  v_modes := v_payload -> 'practice_modes';
  return exists (
    select 1
    from jsonb_array_elements_text(v_modes) elem
    where elem = p_mode
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Super-admin platform settings RPCs
-- ---------------------------------------------------------------------------

create or replace function public.list_platform_plan_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super admin only';
  end if;

  return jsonb_build_object(
    'limits', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'plan_tier', l.plan_tier,
          'max_groups_owned', l.max_groups_owned,
          'max_members_per_group', l.max_members_per_group,
          'updated_at', l.updated_at,
          'updated_by_email', l.updated_by_email
        ) order by l.plan_tier
      ), '[]'::jsonb)
      from public.platform_plan_limits l
    ),
    'practice_modes', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'plan_tier', ppm.plan_tier,
          'practice_mode', ppm.practice_mode,
          'enabled', ppm.enabled,
          'updated_at', ppm.updated_at,
          'updated_by_email', ppm.updated_by_email
        ) order by ppm.plan_tier, ppm.practice_mode
      ), '[]'::jsonb)
      from public.platform_plan_practice_modes ppm
    )
  );
end;
$$;

create or replace function public.update_platform_plan_limits(
  p_plan_tier text,
  p_max_groups_owned integer,
  p_max_members_per_group integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
begin
  if not public.is_super_admin() then
    raise exception 'Super admin only';
  end if;
  if p_plan_tier not in ('free', 'pro', 'churches') then
    raise exception 'Invalid plan tier';
  end if;
  if p_max_groups_owned < 0 or p_max_members_per_group < 1 then
    raise exception 'Invalid limits';
  end if;

  insert into public.platform_plan_limits (
    plan_tier, max_groups_owned, max_members_per_group, updated_at, updated_by_email
  ) values (
    p_plan_tier, p_max_groups_owned, p_max_members_per_group, now(), v_email
  )
  on conflict (plan_tier) do update
    set max_groups_owned = excluded.max_groups_owned,
        max_members_per_group = excluded.max_members_per_group,
        updated_at = now(),
        updated_by_email = excluded.updated_by_email;
end;
$$;

create or replace function public.update_platform_plan_practice_modes(
  p_plan_tier text,
  p_modes jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  v_mode text;
  v_enabled boolean;
  v_allowed constant text[] := array['type', 'word', 'reorder', 'firstLetters', 'recite'];
begin
  if not public.is_super_admin() then
    raise exception 'Super admin only';
  end if;
  if p_plan_tier not in ('free', 'pro', 'churches') then
    raise exception 'Invalid plan tier';
  end if;

  for v_mode, v_enabled in
    select key, coalesce((value #>> '{}')::boolean, false)
    from jsonb_each(p_modes)
  loop
    if not (v_mode = any (v_allowed)) then
      raise exception 'Invalid practice mode: %', v_mode;
    end if;

    insert into public.platform_plan_practice_modes (
      plan_tier, practice_mode, enabled, updated_at, updated_by_email
    ) values (
      p_plan_tier, v_mode, v_enabled, now(), v_email
    )
    on conflict (plan_tier, practice_mode) do update
      set enabled = excluded.enabled,
          updated_at = now(),
          updated_by_email = excluded.updated_by_email;
  end loop;
end;
$$;

create or replace function public.upsert_user_subscription_free(
  p_email text,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
begin
  if v_email = '' then
    raise exception 'Email is required';
  end if;

  insert into public.user_subscriptions (user_email, plan_tier, plan_status, display_name)
  values (v_email, 'free', 'active', v_name)
  on conflict (user_email) do update
    set display_name = coalesce(excluded.display_name, public.user_subscriptions.display_name),
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Prayer group RPCs (caps + origin tenant)
-- ---------------------------------------------------------------------------

create or replace function public.can_create_prayer_groups(email_to_check text default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(email_to_check, public.current_user_email())));
  v_limits record;
  v_owned integer;
begin
  if v_email is null or v_email = '' then
    return false;
  end if;
  if public.is_super_admin(v_email) then
    return true;
  end if;

  select * into v_limits from public.effective_group_limits_for_email(v_email);
  v_owned := public.count_owned_prayer_groups(v_email);
  return v_owned < v_limits.max_groups_owned;
end;
$$;

create or replace function public.create_prayer_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  v_name text := trim(coalesce(p_name, ''));
  v_group_id uuid;
  v_tenant_id uuid;
  v_member_name text;
  v_limits record;
  v_owned integer;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  if v_name = '' then
    raise exception 'Group name is required';
  end if;

  select * into v_limits from public.effective_group_limits_for_email(v_email);
  v_owned := public.count_owned_prayer_groups(v_email);
  if v_owned >= v_limits.max_groups_owned and not public.is_super_admin(v_email) then
    raise exception 'Group limit reached for your plan';
  end if;

  select tm.tenant_id
    into v_tenant_id
  from public.tenant_memberships tm
  join public.tenants t on t.id = tm.tenant_id
  where tm.user_email = v_email
    and coalesce(tm.is_active, true) = true
    and t.plan_tier = 'churches'
    and t.plan_status in ('active', 'trialing')
  order by t.created_at
  limit 1;

  if v_tenant_id is null then
    v_tenant_id := public.default_tenant_id();
  end if;

  select coalesce(
    (select us.display_name from public.user_subscriptions us
      where us.user_email = v_email and nullif(trim(us.display_name), '') is not null),
    (select tm.name from public.tenant_memberships tm
      where tm.user_email = v_email and nullif(trim(tm.name), '') is not null
      limit 1),
    (select m.name from public.prayer_group_members m
      where m.user_email = v_email and nullif(trim(m.name), '') is not null
      limit 1)
  ) into v_member_name;

  insert into public.prayer_groups (name, created_by_email, created_from_tenant_id)
  values (v_name, v_email, v_tenant_id)
  returning id into v_group_id;

  insert into public.prayer_group_members (
    group_id, user_email, role, invited_by_email, name, is_active
  ) values (
    v_group_id, v_email, 'owner', v_email, v_member_name, true
  );

  return v_group_id;
end;
$$;

create or replace function public.invite_prayer_group_member(p_group_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter text := public.current_user_email();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
  v_name text;
  v_owner text;
  v_limits record;
  v_member_count integer;
begin
  if v_inviter is null or v_inviter = '' then
    raise exception 'Not authenticated';
  end if;
  if v_email = '' then
    raise exception 'Email is required';
  end if;
  if not public.is_prayer_group_member(p_group_id, v_inviter) then
    raise exception 'Only group members can invite others';
  end if;

  v_owner := public.prayer_group_owner_email(p_group_id);
  if v_owner is null then
    raise exception 'Group owner not found';
  end if;

  select * into v_limits from public.effective_group_limits_for_email(v_owner);
  v_member_count := public.count_active_prayer_group_members(p_group_id);

  if not exists (
    select 1 from public.prayer_group_members m
    where m.group_id = p_group_id and m.user_email = v_email and coalesce(m.is_active, true) = true
  ) and v_member_count >= v_limits.max_members_per_group then
    raise exception 'Member limit reached for this group';
  end if;

  select coalesce(
    (select us.display_name from public.user_subscriptions us
      where us.user_email = v_email and nullif(trim(us.display_name), '') is not null),
    (select tm.name from public.tenant_memberships tm
      where tm.user_email = v_email and nullif(trim(tm.name), '') is not null
      limit 1),
    (select m.name from public.prayer_group_members m
      where m.user_email = v_email and nullif(trim(m.name), '') is not null
      limit 1)
  ) into v_name;

  insert into public.prayer_group_members (
    group_id, user_email, role, invited_by_email, name, is_active
  ) values (
    p_group_id, v_email, 'member', v_inviter, v_name, true
  )
  on conflict (group_id, user_email) do update
    set is_active = true,
        invited_by_email = excluded.invited_by_email,
        name = coalesce(public.prayer_group_members.name, excluded.name),
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Login gate: free-tier users via user_subscriptions
-- ---------------------------------------------------------------------------

create or replace function public.is_login_allowed_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    nullif(lower(trim(coalesce(p_email, ''))), '') is not null
    and (
      exists (
        select 1
        from public.global_roles gr
        where gr.user_email = lower(trim(p_email))
          and gr.role = 'super_admin'
      )
      or exists (
        select 1
        from public.tenant_memberships tm
        where tm.user_email = lower(trim(p_email))
          and coalesce(tm.is_active, true) = true
          and coalesce(tm.is_blocked, false) = false
      )
      or public.is_any_prayer_group_member(p_email)
      or exists (
        select 1
        from public.user_subscriptions us
        where us.user_email = lower(trim(p_email))
      )
      or (
        not exists (
          select 1 from public.tenant_memberships tm
          where tm.user_email = lower(trim(p_email))
        )
        and not exists (
          select 1 from public.user_subscriptions us
          where us.user_email = lower(trim(p_email))
        )
        and not public.is_any_prayer_group_member(p_email)
      )
    )
    and (
      public.is_any_prayer_group_member(p_email)
      or exists (
        select 1 from public.user_subscriptions us
        where us.user_email = lower(trim(p_email))
      )
      or not exists (
        select 1
        from public.account_approval_requests aar
        where lower(aar.email) = lower(trim(p_email))
          and aar.approval_status = 'pending'
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- Public prayers: churches plan only
-- ---------------------------------------------------------------------------

drop policy if exists tenant_read_prayers on public.prayers;
create policy tenant_read_prayers on public.prayers
  for select to authenticated
  using (
    public.is_tenant_member(tenant_id)
    and public.tenant_has_churches_plan(tenant_id)
  );

drop policy if exists tenant_insert_prayers on public.prayers;
create policy tenant_insert_prayers on public.prayers
  for insert to authenticated
  with check (
    public.is_tenant_member(tenant_id)
    and public.tenant_has_churches_plan(tenant_id)
  );

drop policy if exists tenant_update_prayers on public.prayers;
create policy tenant_update_prayers on public.prayers
  for update to authenticated
  using (
    public.is_tenant_member(tenant_id)
    and public.tenant_has_churches_plan(tenant_id)
  )
  with check (
    public.is_tenant_member(tenant_id)
    and public.tenant_has_churches_plan(tenant_id)
  );

drop policy if exists tenant_read_prayer_updates on public.prayer_updates;
create policy tenant_read_prayer_updates on public.prayer_updates
  for select to authenticated
  using (
    public.is_tenant_member(tenant_id)
    and public.tenant_has_churches_plan(tenant_id)
  );

drop policy if exists tenant_insert_prayer_updates on public.prayer_updates;
create policy tenant_insert_prayer_updates on public.prayer_updates
  for insert to authenticated
  with check (
    public.is_tenant_member(tenant_id)
    and public.tenant_has_churches_plan(tenant_id)
  );

drop policy if exists tenant_update_prayer_updates on public.prayer_updates;
create policy tenant_update_prayer_updates on public.prayer_updates
  for update to authenticated
  using (
    public.is_tenant_member(tenant_id)
    and public.tenant_has_churches_plan(tenant_id)
  )
  with check (
    public.is_tenant_member(tenant_id)
    and public.tenant_has_churches_plan(tenant_id)
  );

-- Unaffiliated personal / memorize for all authenticated users (free tier)

create or replace function public.can_use_unaffiliated_user_data(p_email text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    nullif(lower(trim(coalesce(p_email, public.current_user_email()))), '') is not null
    and (
      public.is_any_prayer_group_member(p_email)
      or exists (
        select 1 from public.user_subscriptions us
        where us.user_email = lower(trim(coalesce(p_email, public.current_user_email())))
      )
      or exists (
        select 1 from public.tenant_memberships tm
        where tm.user_email = lower(trim(coalesce(p_email, public.current_user_email())))
      )
    );
$$;

drop policy if exists memorized_items_select_own on public.memorized_items;
create policy memorized_items_select_own on public.memorized_items
  for select to authenticated
  using (
    (
      lower(user_email) = public.current_user_email()
      and (
        (tenant_id is not null and public.is_tenant_member(tenant_id))
        or (tenant_id is null and public.can_use_unaffiliated_user_data())
      )
    )
    or public.is_super_admin()
  );

drop policy if exists memorized_items_insert_own on public.memorized_items;
create policy memorized_items_insert_own on public.memorized_items
  for insert to authenticated
  with check (
    (
      lower(user_email) = public.current_user_email()
      and (
        (tenant_id is not null and public.is_tenant_member(tenant_id))
        or (tenant_id is null and public.can_use_unaffiliated_user_data())
      )
    )
    or public.is_super_admin()
  );

drop policy if exists memorized_items_update_own on public.memorized_items;
create policy memorized_items_update_own on public.memorized_items
  for update to authenticated
  using (
    (
      lower(user_email) = public.current_user_email()
      and (
        (tenant_id is not null and public.is_tenant_member(tenant_id))
        or (tenant_id is null and public.can_use_unaffiliated_user_data())
      )
    )
    or public.is_super_admin()
  )
  with check (
    (
      lower(user_email) = public.current_user_email()
      and (
        (tenant_id is not null and public.is_tenant_member(tenant_id))
        or (tenant_id is null and public.can_use_unaffiliated_user_data())
      )
    )
    or public.is_super_admin()
  );

drop policy if exists memorized_items_delete_own on public.memorized_items;
create policy memorized_items_delete_own on public.memorized_items
  for delete to authenticated
  using (
    (
      lower(user_email) = public.current_user_email()
      and (
        (tenant_id is not null and public.is_tenant_member(tenant_id))
        or (tenant_id is null and public.can_use_unaffiliated_user_data())
      )
    )
    or public.is_super_admin()
  );

-- Demote default-tenant from churches to free (platform template org, not implicit church)
update public.tenants
set plan_tier = 'free', updated_at = now()
where slug = 'default-tenant'
  and plan_tier = 'churches';

-- Grants
grant execute on function public.user_individual_plan_tier(text) to anon, authenticated, service_role;
grant execute on function public.user_has_pro(text) to anon, authenticated, service_role;
grant execute on function public.user_is_church_member(text) to anon, authenticated, service_role;
grant execute on function public.tenant_has_churches_plan(uuid) to anon, authenticated, service_role;
grant execute on function public.get_user_group_limits(text) to authenticated, service_role;
grant execute on function public.get_user_memorization_practice_modes(text) to authenticated, service_role;
grant execute on function public.user_practice_mode_allowed(text, text) to authenticated, service_role;
grant execute on function public.list_platform_plan_settings() to authenticated, service_role;
grant execute on function public.update_platform_plan_limits(text, integer, integer) to authenticated, service_role;
grant execute on function public.update_platform_plan_practice_modes(text, jsonb) to authenticated, service_role;
grant execute on function public.upsert_user_subscription_free(text, text) to authenticated, service_role;

-- Super-admin prayer listing: churches tenants only
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
    and public.tenant_has_churches_plan(p.tenant_id)
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
    and public.tenant_has_churches_plan(pu.tenant_id)
  order by pu.created_at desc;
end;
$$;
