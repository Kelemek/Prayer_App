-- Church tenant wipe: detach personal user data, delete church-scoped tenant graph, audit.
-- Service-role-only RPC for wipe-church-tenant Edge Function.

-- ---------------------------------------------------------------------------
-- 1) personal_categories: allow unaffiliated (tenant_id null) after church wipe
-- ---------------------------------------------------------------------------

alter table public.personal_categories
  alter column tenant_id drop not null;

drop index if exists public.personal_categories_tenant_user_name_uidx;

create unique index if not exists personal_categories_tenant_user_name_uidx
  on public.personal_categories (tenant_id, lower(user_email), lower(name))
  where tenant_id is not null;

create unique index if not exists personal_categories_unaffiliated_user_name_uidx
  on public.personal_categories (lower(user_email), lower(name))
  where tenant_id is null;

drop policy if exists personal_categories_select_own on public.personal_categories;
create policy personal_categories_select_own
  on public.personal_categories
  for select
  to authenticated
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

drop policy if exists personal_categories_insert_own on public.personal_categories;
create policy personal_categories_insert_own
  on public.personal_categories
  for insert
  to authenticated
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

drop policy if exists personal_categories_update_own on public.personal_categories;
create policy personal_categories_update_own
  on public.personal_categories
  for update
  to authenticated
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

drop policy if exists personal_categories_delete_own on public.personal_categories;
create policy personal_categories_delete_own
  on public.personal_categories
  for delete
  to authenticated
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

-- ---------------------------------------------------------------------------
-- 2) Reminder tables: nullable tenant for detached personal prefs
-- ---------------------------------------------------------------------------

alter table public.user_prayer_item_reminders
  alter column tenant_id drop not null;

drop policy if exists user_prayer_item_reminders_select_own on public.user_prayer_item_reminders;
create policy user_prayer_item_reminders_select_own
  on public.user_prayer_item_reminders for select to authenticated
  using (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    and (
      (
        tenant_id is not null
        and exists (
          select 1
          from public.tenant_memberships tm
          where tm.tenant_id = user_prayer_item_reminders.tenant_id
            and tm.user_email = lower((auth.jwt() ->> 'email'))
            and tm.is_active is distinct from false
        )
      )
      or (
        tenant_id is null
        and prayer_kind = 'personal'
      )
    )
  );

drop policy if exists user_prayer_item_reminders_insert_own on public.user_prayer_item_reminders;
create policy user_prayer_item_reminders_insert_own
  on public.user_prayer_item_reminders for insert to authenticated
  with check (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    and (
      (
        tenant_id is not null
        and exists (
          select 1
          from public.tenant_memberships tm
          where tm.tenant_id = user_prayer_item_reminders.tenant_id
            and tm.user_email = lower((auth.jwt() ->> 'email'))
            and tm.is_active is distinct from false
        )
      )
      or (
        tenant_id is null
        and prayer_kind = 'personal'
      )
    )
  );

drop policy if exists user_prayer_item_reminders_update_own on public.user_prayer_item_reminders;
create policy user_prayer_item_reminders_update_own
  on public.user_prayer_item_reminders for update to authenticated
  using (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    and (
      (
        tenant_id is not null
        and exists (
          select 1
          from public.tenant_memberships tm
          where tm.tenant_id = user_prayer_item_reminders.tenant_id
            and tm.user_email = lower((auth.jwt() ->> 'email'))
            and tm.is_active is distinct from false
        )
      )
      or (
        tenant_id is null
        and prayer_kind = 'personal'
      )
    )
  )
  with check (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    and (
      (
        tenant_id is not null
        and exists (
          select 1
          from public.tenant_memberships tm
          where tm.tenant_id = user_prayer_item_reminders.tenant_id
            and tm.user_email = lower((auth.jwt() ->> 'email'))
            and tm.is_active is distinct from false
        )
      )
      or (
        tenant_id is null
        and prayer_kind = 'personal'
      )
    )
  );

drop policy if exists user_prayer_item_reminders_delete_own on public.user_prayer_item_reminders;
create policy user_prayer_item_reminders_delete_own
  on public.user_prayer_item_reminders for delete to authenticated
  using (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    and (
      (
        tenant_id is not null
        and exists (
          select 1
          from public.tenant_memberships tm
          where tm.tenant_id = user_prayer_item_reminders.tenant_id
            and tm.user_email = lower((auth.jwt() ->> 'email'))
            and tm.is_active is distinct from false
        )
      )
      or (
        tenant_id is null
        and prayer_kind = 'personal'
      )
    )
  );

alter table public.user_memorization_hour_reminders
  alter column tenant_id drop not null;

drop policy if exists user_memorization_hour_reminders_select_own
  on public.user_memorization_hour_reminders;
create policy user_memorization_hour_reminders_select_own
  on public.user_memorization_hour_reminders for select to authenticated
  using (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    and (
      (tenant_id is not null and public.is_tenant_member(tenant_id))
      or tenant_id is null
    )
  );

drop policy if exists user_memorization_hour_reminders_insert_own
  on public.user_memorization_hour_reminders;
create policy user_memorization_hour_reminders_insert_own
  on public.user_memorization_hour_reminders for insert to authenticated
  with check (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    and (
      (tenant_id is not null and public.is_tenant_member(tenant_id))
      or tenant_id is null
    )
  );

drop policy if exists user_memorization_hour_reminders_delete_own
  on public.user_memorization_hour_reminders;
create policy user_memorization_hour_reminders_delete_own
  on public.user_memorization_hour_reminders for delete to authenticated
  using (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    and (
      (tenant_id is not null and public.is_tenant_member(tenant_id))
      or tenant_id is null
    )
  );

-- Any authenticated user with an email may use unaffiliated personal/memorize rows.
create or replace function public.can_use_unaffiliated_user_data(p_email text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select nullif(lower(trim(coalesce(p_email, public.current_user_email()))), '') is not null;
$$;

-- Re-attach personal categories when user joins a new tenant.
create or replace function public.attach_unaffiliated_user_data_to_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.personal_prayers
  set tenant_id = new.tenant_id
  where lower(user_email) = lower(new.user_email)
    and tenant_id is null;

  update public.memorized_items
  set tenant_id = new.tenant_id
  where lower(user_email) = lower(new.user_email)
    and tenant_id is null;

  update public.personal_categories
  set tenant_id = new.tenant_id
  where lower(user_email) = lower(new.user_email)
    and tenant_id is null;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Audit table (no FK to tenants)
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_wipe_events (
  tenant_id uuid primary key,
  tenant_slug text not null,
  tenant_name text not null,
  wiped_at timestamptz not null default now(),
  wiped_by_email text,
  notes jsonb
);

comment on table public.tenant_wipe_events is
  'Church tenant hard-delete audit; survives tenant row removal. Service role only.';

alter table public.tenant_wipe_events enable row level security;

revoke all on table public.tenant_wipe_events from public, anon, authenticated;
grant all on table public.tenant_wipe_events to service_role;

-- ---------------------------------------------------------------------------
-- 4) wipe_church_tenant RPC
-- ---------------------------------------------------------------------------

create or replace function public.wipe_church_tenant(
  p_tenant_id uuid,
  p_confirm_slug text,
  p_wiped_by_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_name text;
  v_stripe_customer_id text;
  v_stripe_subscription_id text;
  v_member_emails text[] := array[]::text[];
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
  v_prior jsonb;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id required';
  end if;

  select to_jsonb(t.*)
  into v_prior
  from public.tenant_wipe_events t
  where t.tenant_id = p_tenant_id;

  if v_prior is not null then
    return v_prior || jsonb_build_object('already_wiped', true);
  end if;

  select t.slug, t.name, t.stripe_customer_id, t.stripe_subscription_id
  into v_slug, v_name, v_stripe_customer_id, v_stripe_subscription_id
  from public.tenants t
  where t.id = p_tenant_id;

  if v_slug is null then
    raise exception 'Tenant not found';
  end if;

  if lower(trim(v_slug)) = 'default-tenant' then
    raise exception 'Cannot wipe default tenant';
  end if;

  if lower(trim(coalesce(p_confirm_slug, ''))) <> lower(trim(v_slug)) then
    raise exception 'Slug confirmation mismatch';
  end if;

  select coalesce(array_agg(distinct lower(trim(tm.user_email))), array[]::text[])
  into v_member_emails
  from public.tenant_memberships tm
  where tm.tenant_id = p_tenant_id
    and nullif(lower(trim(tm.user_email)), '') is not null;

  update public.personal_prayers
  set tenant_id = null
  where tenant_id = p_tenant_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('personal_prayers_detached', v_n);

  update public.memorized_items
  set tenant_id = null
  where tenant_id = p_tenant_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('memorized_items_detached', v_n);

  update public.personal_categories
  set tenant_id = null
  where tenant_id = p_tenant_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('personal_categories_detached', v_n);

  update public.user_prayer_item_reminders
  set tenant_id = null
  where tenant_id = p_tenant_id
    and prayer_kind = 'personal';
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('personal_item_reminders_detached', v_n);

  update public.user_memorization_hour_reminders
  set tenant_id = null
  where tenant_id = p_tenant_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('memorization_hour_reminders_detached', v_n);

  delete from public.analytics where tenant_id = p_tenant_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('analytics_deleted', v_n);

  delete from public.email_queue where tenant_id = p_tenant_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('email_queue_deleted', v_n);

  delete from public.account_approval_requests where tenant_id = p_tenant_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('account_approval_requests_deleted', v_n);

  delete from public.tenants where id = p_tenant_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'Tenant delete failed';
  end if;
  v_counts := v_counts || jsonb_build_object('tenant_deleted', v_n);

  insert into public.tenant_wipe_events (
    tenant_id,
    tenant_slug,
    tenant_name,
    wiped_by_email,
    notes
  )
  values (
    p_tenant_id,
    v_slug,
    v_name,
    nullif(lower(trim(coalesce(p_wiped_by_email, ''))), ''),
    jsonb_build_object(
      'counts', v_counts,
      'stripe_customer_id', v_stripe_customer_id,
      'stripe_subscription_id', v_stripe_subscription_id,
      'member_emails', v_member_emails
    )
  );

  return jsonb_build_object(
    'already_wiped', false,
    'tenant_id', p_tenant_id,
    'slug', v_slug,
    'stripe_customer_id', v_stripe_customer_id,
    'stripe_subscription_id', v_stripe_subscription_id,
    'member_emails', v_member_emails,
    'counts', v_counts
  );
end;
$$;

revoke all on function public.wipe_church_tenant(uuid, text, text) from public, anon, authenticated;
grant execute on function public.wipe_church_tenant(uuid, text, text) to service_role;
