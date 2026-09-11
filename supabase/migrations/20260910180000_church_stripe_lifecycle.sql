-- Church Stripe billing lifecycle: tenant Stripe IDs, past_due grace, entitlement, webhook idempotency.

-- ---------------------------------------------------------------------------
-- Platform grace setting (super-admin)
-- ---------------------------------------------------------------------------

alter table public.admin_settings
  add column if not exists church_past_due_grace_days integer not null default 7;

alter table public.admin_settings
  drop constraint if exists admin_settings_church_past_due_grace_days_check;

alter table public.admin_settings
  add constraint admin_settings_church_past_due_grace_days_check
  check (church_past_due_grace_days between 1 and 90);

update public.admin_settings
set church_past_due_grace_days = 7
where id = 1
  and church_past_due_grace_days is null;

comment on column public.admin_settings.church_past_due_grace_days is
  'Days to keep Church features after Stripe past_due before downgrade.';

-- ---------------------------------------------------------------------------
-- Tenant Stripe / billing state
-- ---------------------------------------------------------------------------

alter table public.tenants
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_cancel_at_period_end boolean not null default false,
  add column if not exists stripe_current_period_end timestamptz,
  add column if not exists past_due_since timestamptz,
  add column if not exists grace_until timestamptz,
  add column if not exists billing_past_due_notified_at timestamptz;

create unique index if not exists tenants_stripe_customer_id_unique
  on public.tenants (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists tenants_stripe_subscription_id_unique
  on public.tenants (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.tenant_subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

-- ---------------------------------------------------------------------------
-- Webhook idempotency
-- ---------------------------------------------------------------------------

create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

-- service_role only (Edge Functions)
revoke all on public.stripe_webhook_events from anon, authenticated;
grant all on public.stripe_webhook_events to service_role;

-- ---------------------------------------------------------------------------
-- Entitlement helper
-- ---------------------------------------------------------------------------

create or replace function public.tenant_has_churches_plan(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
      and t.plan_tier = 'churches'
      and (
        t.plan_status in ('active', 'trialing')
        or (
          t.plan_status = 'past_due'
          and t.grace_until is not null
          and t.grace_until > now()
        )
        or (
          t.plan_status = 'canceled'
          and t.stripe_current_period_end is not null
          and t.stripe_current_period_end > now()
        )
      )
  );
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
      and public.tenant_has_churches_plan(t.id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Super-admin billing settings RPCs
-- ---------------------------------------------------------------------------

create or replace function public.get_platform_billing_settings()
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
    'church_past_due_grace_days', (
      select a.church_past_due_grace_days
      from public.admin_settings a
      where a.id = 1
    )
  );
end;
$$;

create or replace function public.update_church_past_due_grace_days(p_days integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super admin only';
  end if;
  if p_days < 1 or p_days > 90 then
    raise exception 'Grace days must be between 1 and 90';
  end if;

  update public.admin_settings
  set church_past_due_grace_days = p_days,
      updated_at = now()
  where id = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stripe billing apply (service_role / Edge Functions)
-- ---------------------------------------------------------------------------

create or replace function public.apply_tenant_stripe_billing(
  p_tenant_id uuid,
  p_plan_tier public.plan_tier,
  p_plan_status public.plan_status,
  p_stripe_customer_id text default null,
  p_stripe_subscription_id text default null,
  p_stripe_cancel_at_period_end boolean default null,
  p_stripe_current_period_end timestamptz default null,
  p_past_due_since timestamptz default null,
  p_grace_until timestamptz default null,
  p_clear_past_due boolean default false,
  p_billing_past_due_notified_at timestamptz default null,
  p_clear_billing_past_due_notified boolean default false
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.tenants;
  v_after public.tenants;
  v_customer text := nullif(trim(coalesce(p_stripe_customer_id, '')), '');
  v_subscription text := nullif(trim(coalesce(p_stripe_subscription_id, '')), '');
begin
  select * into v_before from public.tenants where id = p_tenant_id;
  if v_before.id is null then
    raise exception 'Tenant not found';
  end if;

  update public.tenants t
  set
    plan_tier = p_plan_tier,
    plan_status = p_plan_status,
    stripe_customer_id = coalesce(v_customer, t.stripe_customer_id),
    stripe_subscription_id = case
      when v_subscription is not null then v_subscription
      when p_stripe_subscription_id is null and p_plan_tier = 'free' then null
      else t.stripe_subscription_id
    end,
    stripe_cancel_at_period_end = coalesce(
      p_stripe_cancel_at_period_end,
      t.stripe_cancel_at_period_end
    ),
    stripe_current_period_end = case
      when p_stripe_current_period_end is not null then p_stripe_current_period_end
      when p_plan_tier = 'free' then null
      else t.stripe_current_period_end
    end,
    past_due_since = case
      when p_clear_past_due then null
      when p_past_due_since is not null then p_past_due_since
      else t.past_due_since
    end,
    grace_until = case
      when p_clear_past_due then null
      when p_grace_until is not null then p_grace_until
      else t.grace_until
    end,
    billing_past_due_notified_at = case
      when p_clear_billing_past_due_notified then null
      when p_billing_past_due_notified_at is not null then p_billing_past_due_notified_at
      else t.billing_past_due_notified_at
    end,
    updated_at = now()
  where t.id = p_tenant_id
  returning * into v_after;

  if v_before.plan_tier is distinct from v_after.plan_tier
     or v_before.plan_status is distinct from v_after.plan_status then
    insert into public.tenant_subscriptions (
      tenant_id,
      plan_tier,
      status,
      source,
      starts_at,
      grace_until,
      stripe_customer_id,
      stripe_subscription_id,
      updated_at
    ) values (
      p_tenant_id,
      v_after.plan_tier,
      v_after.plan_status,
      'future_stripe',
      now(),
      v_after.grace_until,
      v_after.stripe_customer_id,
      v_after.stripe_subscription_id,
      now()
    );

    insert into public.tenant_subscription_events (
      tenant_id,
      event_type,
      payload
    ) values (
      p_tenant_id,
      'stripe_billing_applied',
      jsonb_build_object(
        'plan_tier', v_after.plan_tier,
        'plan_status', v_after.plan_status,
        'stripe_customer_id', v_after.stripe_customer_id,
        'stripe_subscription_id', v_after.stripe_subscription_id,
        'grace_until', v_after.grace_until,
        'stripe_current_period_end', v_after.stripe_current_period_end
      )
    );
  end if;

  return v_after;
end;
$$;

create or replace function public.downgrade_church_tenant_after_access_end(p_tenant_id uuid)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.apply_tenant_stripe_billing(
    p_tenant_id,
    'free'::public.plan_tier,
    'canceled'::public.plan_status,
    p_stripe_subscription_id := null,
    p_stripe_cancel_at_period_end := false,
    p_stripe_current_period_end := null,
    p_clear_past_due := true,
    p_clear_billing_past_due_notified := true
  );
end;
$$;

create or replace function public.list_church_tenants_due_for_billing_downgrade()
returns setof public.tenants
language sql
stable
security definer
set search_path = public
as $$
  select t.*
  from public.tenants t
  where t.plan_tier = 'churches'
    and (
      (
        t.plan_status = 'past_due'
        and t.grace_until is not null
        and t.grace_until <= now()
      )
      or (
        t.plan_status = 'canceled'
        and t.stripe_current_period_end is not null
        and t.stripe_current_period_end <= now()
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- Manual super-admin plan updates (comps) — do not clobber Stripe IDs
-- ---------------------------------------------------------------------------

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
  v_before public.tenants;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin only';
  end if;

  select * into v_before from public.tenants where id = p_tenant_id;
  if v_before.id is null then
    raise exception 'Tenant not found';
  end if;

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

revoke execute on function public.update_tenant_subscription(uuid, public.plan_tier, public.plan_status, public.subscription_source, timestamptz, text) from service_role;
grant execute on function public.update_tenant_subscription(uuid, public.plan_tier, public.plan_status, public.subscription_source, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Tenant context includes billing fields for admins
-- ---------------------------------------------------------------------------

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
      'plan_status', t.plan_status,
      'stripe_customer_id', t.stripe_customer_id,
      'stripe_subscription_id', t.stripe_subscription_id,
      'stripe_cancel_at_period_end', t.stripe_cancel_at_period_end,
      'stripe_current_period_end', t.stripe_current_period_end,
      'past_due_since', t.past_due_since,
      'grace_until', t.grace_until
    ) as tenant,
    super_admin as is_super_admin
  from public.tenant_memberships tm
  join public.tenants t on t.id = tm.tenant_id
  where lower(tm.user_email) = normalized_email;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_prayer_group: use entitlement helper
-- ---------------------------------------------------------------------------

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
    and public.tenant_has_churches_plan(t.id)
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

-- ---------------------------------------------------------------------------
-- Memorization recite gate uses entitlement helper
-- ---------------------------------------------------------------------------

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
          and public.tenant_has_churches_plan(t.id)
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

-- ---------------------------------------------------------------------------
-- Super-admin tenant billing list
-- ---------------------------------------------------------------------------

create or replace function public.list_tenant_billing_for_super_admin()
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

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'slug', t.slug,
          'plan_tier', t.plan_tier,
          'plan_status', t.plan_status,
          'stripe_customer_id', t.stripe_customer_id,
          'stripe_subscription_id', t.stripe_subscription_id,
          'stripe_cancel_at_period_end', t.stripe_cancel_at_period_end,
          'stripe_current_period_end', t.stripe_current_period_end,
          'past_due_since', t.past_due_since,
          'grace_until', t.grace_until,
          'billing_past_due_notified_at', t.billing_past_due_notified_at
        )
        order by t.name
      )
      from public.tenants t
    ),
    '[]'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant execute on function public.get_platform_billing_settings() to authenticated, service_role;
grant execute on function public.update_church_past_due_grace_days(integer) to authenticated, service_role;
grant execute on function public.apply_tenant_stripe_billing(
  uuid, public.plan_tier, public.plan_status, text, text, boolean, timestamptz, timestamptz, timestamptz, boolean, timestamptz, boolean
) to service_role;
grant execute on function public.downgrade_church_tenant_after_access_end(uuid) to service_role;
grant execute on function public.list_church_tenants_due_for_billing_downgrade() to service_role;
grant execute on function public.list_tenant_billing_for_super_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Hourly cron: reconcile grace / period-end downgrades
-- ---------------------------------------------------------------------------

create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
declare
  jid bigint;
begin
  select j.jobid into jid
  from cron.job j
  where j.jobname = 'invoke-reconcile-church-billing';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
end $$;

select cron.schedule(
  'invoke-reconcile-church-billing',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select ds.decrypted_secret from vault.decrypted_secrets ds where ds.name = 'project_url' limit 1)
      || '/functions/v1/reconcile-church-billing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (select ds.decrypted_secret from vault.decrypted_secrets ds where ds.name = 'service_role_key' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
