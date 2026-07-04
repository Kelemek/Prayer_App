-- Merge email_subscribers into tenant_memberships (one row per person per tenant).
-- Replaces email_subscribers table with a compatibility VIEW + INSTEAD OF triggers.

-- 1) Expand tenant_memberships with subscriber profile columns
alter table public.tenant_memberships
  add column if not exists name text not null default '',
  add column if not exists is_active boolean not null default true,
  add column if not exists is_blocked boolean not null default false,
  add column if not exists receive_admin_emails boolean not null default true,
  add column if not exists receive_push boolean not null default false,
  add column if not exists receive_admin_push boolean not null default false,
  add column if not exists badge_functionality_enabled boolean not null default false,
  add column if not exists default_prayer_view varchar(20) not null default 'current',
  add column if not exists in_planning_center boolean,
  add column if not exists planning_center_checked_at timestamptz,
  add column if not exists planning_center_list_id text,
  add column if not exists last_activity_date timestamptz,
  add column if not exists unsubscribe_token text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

alter table public.tenant_memberships
  drop constraint if exists tenant_memberships_default_prayer_view_check;

alter table public.tenant_memberships
  add constraint tenant_memberships_default_prayer_view_check
  check (default_prayer_view in ('current', 'personal'));

-- 2) Backfill from email_subscribers into tenant_memberships
insert into public.tenant_memberships (
  tenant_id,
  user_email,
  role,
  name,
  is_active,
  is_blocked,
  receive_admin_emails,
  receive_push,
  receive_admin_push,
  badge_functionality_enabled,
  default_prayer_view,
  in_planning_center,
  planning_center_checked_at,
  planning_center_list_id,
  last_activity_date,
  unsubscribe_token,
  created_at,
  updated_at
)
select
  es.tenant_id,
  lower(trim(es.email)),
  case when coalesce(es.is_admin, false) then 'tenant_admin'::public.tenant_membership_role
       else 'member'::public.tenant_membership_role end,
  coalesce(es.name, ''),
  coalesce(es.is_active, true),
  coalesce(es.is_blocked, false),
  coalesce(es.receive_admin_emails, true),
  coalesce(es.receive_push, false),
  coalesce(es.receive_admin_push, false),
  coalesce(es.badge_functionality_enabled, false),
  coalesce(es.default_prayer_view, 'current'),
  es.in_planning_center,
  es.planning_center_checked_at,
  es.planning_center_list_id,
  es.last_activity_date,
  es.unsubscribe_token,
  coalesce(es.created_at, now()),
  coalesce(es.updated_at, now())
from public.email_subscribers es
where es.tenant_id is not null
on conflict (tenant_id, user_email) do update set
  name = excluded.name,
  role = case
    when excluded.role = 'tenant_admin'::public.tenant_membership_role then excluded.role
    when tenant_memberships.role = 'tenant_admin'::public.tenant_membership_role then tenant_memberships.role
    else excluded.role
  end,
  is_active = excluded.is_active,
  is_blocked = excluded.is_blocked,
  receive_admin_emails = excluded.receive_admin_emails,
  receive_push = excluded.receive_push,
  receive_admin_push = excluded.receive_admin_push,
  badge_functionality_enabled = excluded.badge_functionality_enabled,
  default_prayer_view = excluded.default_prayer_view,
  in_planning_center = coalesce(excluded.in_planning_center, tenant_memberships.in_planning_center),
  planning_center_checked_at = coalesce(excluded.planning_center_checked_at, tenant_memberships.planning_center_checked_at),
  planning_center_list_id = coalesce(excluded.planning_center_list_id, tenant_memberships.planning_center_list_id),
  last_activity_date = coalesce(excluded.last_activity_date, tenant_memberships.last_activity_date),
  unsubscribe_token = coalesce(excluded.unsubscribe_token, tenant_memberships.unsubscribe_token),
  updated_at = now();

-- Ensure unsubscribe_token on all rows
update public.tenant_memberships
set unsubscribe_token = encode(gen_random_bytes(32), 'hex')
where unsubscribe_token is null or unsubscribe_token = '';

alter table public.tenant_memberships
  alter column unsubscribe_token set default encode(gen_random_bytes(32), 'hex');

alter table public.tenant_memberships
  alter column unsubscribe_token set not null;

create unique index if not exists tenant_memberships_unsubscribe_token_key
  on public.tenant_memberships (unsubscribe_token);

-- 3) Admin settings: single 6-digit test code
alter table public.admin_settings
  add column if not exists test_account_code_6 text default null;

update public.admin_settings
set test_account_code_6 = coalesce(
  nullif(trim(test_account_code_6), ''),
  nullif(trim(test_account_code_8), ''),
  nullif(trim(test_account_code_4), '')
)
where id = 1;

update public.admin_settings
set verification_code_length = 6
where id = 1;

alter table public.admin_settings
  drop constraint if exists admin_settings_verification_code_length_check;

alter table public.admin_settings
  add constraint admin_settings_verification_code_length_check
  check (verification_code_length = 6);

-- 4) Replace email_subscribers table with compatibility view
drop trigger if exists email_subscribers_updated_at on public.email_subscribers;

alter table if exists public.approval_codes
  drop constraint if exists approval_codes_admin_email_fkey;

alter table if exists public.device_tokens
  drop constraint if exists device_tokens_user_email_fkey;

alter table if exists public.user_prayer_hour_reminders
  drop constraint if exists user_prayer_hour_reminders_user_email_fkey;

alter table public.email_subscribers rename to email_subscribers_legacy;

create or replace view public.email_subscribers as
select
  tm.id,
  tm.name,
  tm.user_email as email,
  tm.is_active,
  tm.created_at,
  tm.updated_at,
  (tm.role = 'tenant_admin'::public.tenant_membership_role) as is_admin,
  tm.receive_admin_emails,
  tm.is_blocked,
  tm.in_planning_center,
  tm.planning_center_checked_at,
  tm.last_activity_date,
  tm.badge_functionality_enabled,
  tm.default_prayer_view,
  tm.tenant_id,
  tm.planning_center_list_id,
  tm.receive_push,
  tm.receive_admin_push,
  tm.unsubscribe_token
from public.tenant_memberships tm;

create or replace function public.email_subscribers_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_memberships (
    tenant_id,
    user_email,
    role,
    name,
    is_active,
    is_blocked,
    receive_admin_emails,
    receive_push,
    receive_admin_push,
    badge_functionality_enabled,
    default_prayer_view,
    in_planning_center,
    planning_center_checked_at,
    planning_center_list_id,
    last_activity_date,
    unsubscribe_token,
    created_at,
    updated_at
  ) values (
    new.tenant_id,
    lower(trim(new.email)),
    case when coalesce(new.is_admin, false) then 'tenant_admin'::public.tenant_membership_role
         else 'member'::public.tenant_membership_role end,
    coalesce(new.name, ''),
    coalesce(new.is_active, true),
    coalesce(new.is_blocked, false),
    coalesce(new.receive_admin_emails, true),
    coalesce(new.receive_push, false),
    coalesce(new.receive_admin_push, false),
    coalesce(new.badge_functionality_enabled, false),
    coalesce(new.default_prayer_view, 'current'),
    new.in_planning_center,
    new.planning_center_checked_at,
    new.planning_center_list_id,
    new.last_activity_date,
    coalesce(new.unsubscribe_token, encode(gen_random_bytes(32), 'hex')),
    coalesce(new.created_at, now()),
    coalesce(new.updated_at, now())
  )
  returning id into new.id;
  return new;
end;
$$;

create or replace function public.email_subscribers_view_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tenant_memberships tm
  set
    name = coalesce(new.name, tm.name),
    user_email = lower(trim(new.email)),
    role = case
      when coalesce(new.is_admin, false) then 'tenant_admin'::public.tenant_membership_role
      when tm.role = 'tenant_admin'::public.tenant_membership_role and new.is_admin is null then tm.role
      else 'member'::public.tenant_membership_role
    end,
    is_active = coalesce(new.is_active, tm.is_active),
    is_blocked = coalesce(new.is_blocked, tm.is_blocked),
    receive_admin_emails = coalesce(new.receive_admin_emails, tm.receive_admin_emails),
    receive_push = coalesce(new.receive_push, tm.receive_push),
    receive_admin_push = coalesce(new.receive_admin_push, tm.receive_admin_push),
    badge_functionality_enabled = coalesce(new.badge_functionality_enabled, tm.badge_functionality_enabled),
    default_prayer_view = coalesce(new.default_prayer_view, tm.default_prayer_view),
    in_planning_center = new.in_planning_center,
    planning_center_checked_at = new.planning_center_checked_at,
    planning_center_list_id = new.planning_center_list_id,
    last_activity_date = new.last_activity_date,
    unsubscribe_token = coalesce(new.unsubscribe_token, tm.unsubscribe_token),
    updated_at = now()
  where tm.id = old.id;
  return new;
end;
$$;

create or replace function public.email_subscribers_view_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.tenant_memberships where id = old.id;
  return old;
end;
$$;

create trigger email_subscribers_instead_of_insert
  instead of insert on public.email_subscribers
  for each row execute function public.email_subscribers_view_insert();

create trigger email_subscribers_instead_of_update
  instead of update on public.email_subscribers
  for each row execute function public.email_subscribers_view_update();

create trigger email_subscribers_instead_of_delete
  instead of delete on public.email_subscribers
  for each row execute function public.email_subscribers_view_delete();

-- updated_at trigger on base table
create or replace function public.update_tenant_memberships_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenant_memberships_updated_at on public.tenant_memberships;
create trigger tenant_memberships_updated_at
  before update on public.tenant_memberships
  for each row execute function public.update_tenant_memberships_updated_at();

-- 5) is_tenant_member respects active + not blocked
create or replace function public.is_tenant_member(tenant_to_check uuid, email_to_check text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = tenant_to_check
      and tm.user_email = lower(coalesce(email_to_check, public.current_user_email()))
      and coalesce(tm.is_active, true) = true
      and coalesce(tm.is_blocked, false) = false
  ) or public.is_super_admin(email_to_check);
$$;

grant execute on function public.is_tenant_member(uuid, text) to anon, authenticated, service_role;

-- RPC: check if email is configured app test account (for login UI only)
create or replace function public.is_test_account_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_settings s
    where s.id = 1
      and nullif(trim(lower(s.test_account_email)), '') = lower(trim(coalesce(p_email, '')))
  );
$$;

grant execute on function public.is_test_account_email(text) to anon, authenticated, service_role;
