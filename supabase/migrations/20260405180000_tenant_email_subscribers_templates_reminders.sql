-- Tenant-scoped email subscribers, email templates, reminder settings, and queue.
-- Same email may exist in different tenants (composite uniqueness).

-- 1) Drop FKs that reference email_subscribers(email) so email is not required to be globally unique.
alter table if exists public.approval_codes
  drop constraint if exists approval_codes_admin_email_fkey;

alter table if exists public.device_tokens
  drop constraint if exists device_tokens_user_email_fkey;

alter table if exists public.user_prayer_hour_reminders
  drop constraint if exists user_prayer_hour_reminders_user_email_fkey;

-- 2) email_subscribers.tenant_id
alter table public.email_subscribers
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

with dt as (
  select id from public.tenants where slug = 'default-tenant' limit 1
)
update public.email_subscribers es
set tenant_id = dt.id
from dt
where es.tenant_id is null;

alter table public.email_subscribers
  alter column tenant_id set not null;

alter table public.email_subscribers
  drop constraint if exists email_subscribers_email_key;

drop index if exists public.email_subscribers_email_key;

create unique index if not exists email_subscribers_tenant_email_lower_idx
  on public.email_subscribers (tenant_id, lower(email));

create index if not exists idx_email_subscribers_tenant_id on public.email_subscribers (tenant_id);

-- 3) email_templates.tenant_id + seed per tenant
alter table public.email_templates
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

with dt as (
  select id from public.tenants where slug = 'default-tenant' limit 1
)
update public.email_templates et
set tenant_id = dt.id
from dt
where et.tenant_id is null;

alter table public.email_templates
  alter column tenant_id set not null;

alter table public.email_templates
  drop constraint if exists email_templates_template_key_key;

drop index if exists public.email_templates_template_key_key;

create unique index if not exists email_templates_tenant_template_key_idx
  on public.email_templates (tenant_id, template_key);

create index if not exists idx_email_templates_tenant_id on public.email_templates (tenant_id);

-- Copy template rows from default tenant to every other tenant (same keys/content). Idempotent.
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
  t.id,
  src.template_key,
  src.name,
  src.subject,
  src.html_body,
  src.text_body,
  src.description,
  src.created_at,
  src.updated_at
from public.tenants t
cross join lateral (
  select et.*
  from public.email_templates et
  where et.tenant_id = (select id from public.tenants where slug = 'default-tenant' limit 1)
) src
where t.id <> (select id from public.tenants where slug = 'default-tenant' limit 1)
  and not exists (
    select 1
    from public.email_templates existing
    where existing.tenant_id = t.id
      and existing.template_key = src.template_key
  );

-- 4) Reminder settings on tenant_settings (mirror admin_settings)
alter table public.tenant_settings
  add column if not exists enable_reminders boolean not null default false,
  add column if not exists reminder_interval_days integer not null default 7,
  add column if not exists enable_auto_archive boolean not null default false,
  add column if not exists days_before_archive integer not null default 7;

alter table public.tenant_settings
  drop constraint if exists tenant_settings_reminder_interval_days_range;

alter table public.tenant_settings
  add constraint tenant_settings_reminder_interval_days_range
  check (reminder_interval_days >= 1 and reminder_interval_days <= 90);

alter table public.tenant_settings
  drop constraint if exists tenant_settings_days_before_archive_range;

alter table public.tenant_settings
  add constraint tenant_settings_days_before_archive_range
  check (days_before_archive >= 1 and days_before_archive <= 90);

update public.tenant_settings ts
set
  enable_reminders = coalesce(a.enable_reminders, ts.enable_reminders),
  reminder_interval_days = coalesce(a.reminder_interval_days, ts.reminder_interval_days),
  enable_auto_archive = coalesce(a.enable_auto_archive, ts.enable_auto_archive),
  days_before_archive = coalesce(a.days_before_archive, ts.days_before_archive)
from public.admin_settings a
where a.id = 1;

-- 5) email_queue.tenant_id for template resolution
alter table public.email_queue
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null;

create index if not exists idx_email_queue_tenant_id on public.email_queue (tenant_id);

with dt as (select id from public.tenants where slug = 'default-tenant' limit 1)
update public.email_queue eq
set tenant_id = dt.id
from dt
where eq.tenant_id is null;

with dt as (select id from public.tenants where slug = 'default-tenant' limit 1)
update public.account_approval_requests r
set tenant_id = dt.id
from dt
where r.tenant_id is null;

-- 6) New tenants: ensure tenant_settings row and clone email templates from default tenant.
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

  update public.tenant_settings ts
  set
    enable_reminders = coalesce(a.enable_reminders, ts.enable_reminders),
    reminder_interval_days = coalesce(a.reminder_interval_days, ts.reminder_interval_days),
    enable_auto_archive = coalesce(a.enable_auto_archive, ts.enable_auto_archive),
    days_before_archive = coalesce(a.days_before_archive, ts.days_before_archive)
  from public.admin_settings a
  where a.id = 1
    and ts.tenant_id = new.id;

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

drop trigger if exists tenants_seed_email_defaults on public.tenants;
create trigger tenants_seed_email_defaults
after insert on public.tenants
for each row
execute function public.seed_tenant_email_defaults();

-- 7) Account approval RPC: attach tenant (caller or default-tenant).
drop function if exists public.create_account_approval_request(text, text, text);
drop function if exists public.create_account_approval_request(text, text, text, text);

create or replace function public.create_account_approval_request(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_affiliation_reason text default null,
  p_tenant_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_tenant uuid;
begin
  v_tenant := coalesce(
    p_tenant_id,
    (select id from public.tenants where slug = 'default-tenant' limit 1)
  );
  if v_tenant is null then
    raise exception 'No tenant available for account approval request';
  end if;

  insert into public.account_approval_requests (
    email,
    first_name,
    last_name,
    affiliation_reason,
    approval_status,
    tenant_id
  )
  values (
    p_email,
    p_first_name,
    p_last_name,
    p_affiliation_reason,
    'pending',
    v_tenant
  )
  returning id into v_id;

  return v_id;
end;
$$;
