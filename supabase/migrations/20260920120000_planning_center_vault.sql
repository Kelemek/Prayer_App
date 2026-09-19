-- Planning Center: per-tenant Vault credentials + integration metadata.
-- Secrets: vault name pco_<tenant_uuid> JSON {"app_id","secret"} — service_role RPCs only.

-- ---------------------------------------------------------------------------
-- 1) tenant_integrations (metadata only; no secrets)
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_integrations (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  pco_enabled boolean not null default false,
  pco_configured_at timestamptz,
  pco_app_id_last4 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tenant_integrations is
  'Per-tenant integration flags; PCO credentials live in Vault (pco_<tenant_id>).';

alter table public.tenant_integrations enable row level security;

create policy tenant_integrations_admin_select on public.tenant_integrations
  for select
  using (
    public.is_tenant_admin(tenant_id)
    or public.is_super_admin()
  );

create policy tenant_integrations_admin_write on public.tenant_integrations
  for all
  using (
    public.is_tenant_admin(tenant_id)
    or public.is_super_admin()
  )
  with check (
    public.is_tenant_admin(tenant_id)
    or public.is_super_admin()
  );

grant select, insert, update, delete on public.tenant_integrations to authenticated;
grant all on public.tenant_integrations to service_role;

-- ---------------------------------------------------------------------------
-- 2) Restore tenant_memberships Planning Center columns
-- ---------------------------------------------------------------------------

alter table public.tenant_memberships
  add column if not exists in_planning_center boolean,
  add column if not exists planning_center_checked_at timestamptz,
  add column if not exists planning_center_list_id text;

comment on column public.tenant_memberships.planning_center_list_id is
  'Planning Center list ID for Home Members filter when mapped by a tenant admin.';

-- ---------------------------------------------------------------------------
-- 3) Vault helpers (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.pco_vault_secret_name(p_tenant_id uuid)
returns text
language sql
immutable
as $$
  select 'pco_' || p_tenant_id::text;
$$;

revoke all on function public.pco_vault_secret_name(uuid) from public, anon, authenticated;
grant execute on function public.pco_vault_secret_name(uuid) to service_role;

create or replace function public.pco_vault_put(
  p_tenant_id uuid,
  p_app_id text,
  p_secret text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_name text;
  v_payload text;
  v_last4 text;
  v_secret_id uuid;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id required';
  end if;
  if nullif(trim(p_app_id), '') is null or nullif(trim(p_secret), '') is null then
    raise exception 'app_id and secret required';
  end if;

  v_name := public.pco_vault_secret_name(p_tenant_id);
  v_payload := jsonb_build_object(
    'app_id', trim(p_app_id),
    'secret', trim(p_secret)
  )::text;
  v_last4 := right(trim(p_app_id), 4);

  select s.id into v_secret_id
  from vault.secrets s
  where s.name = v_name
  limit 1;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, v_payload, v_name, 'Planning Center OAuth app per tenant');
  else
    perform vault.create_secret(v_payload, v_name, 'Planning Center OAuth app per tenant');
  end if;

  insert into public.tenant_integrations (
    tenant_id,
    pco_configured_at,
    pco_app_id_last4,
    updated_at
  )
  values (
    p_tenant_id,
    now(),
    v_last4,
    now()
  )
  on conflict (tenant_id) do update set
    pco_configured_at = excluded.pco_configured_at,
    pco_app_id_last4 = excluded.pco_app_id_last4,
    updated_at = now();
end;
$$;

revoke all on function public.pco_vault_put(uuid, text, text) from public, anon, authenticated;
grant execute on function public.pco_vault_put(uuid, text, text) to service_role;

create or replace function public.pco_vault_get(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_name text;
  v_raw text;
begin
  if p_tenant_id is null then
    return null;
  end if;
  v_name := public.pco_vault_secret_name(p_tenant_id);
  select ds.decrypted_secret into v_raw
  from vault.decrypted_secrets ds
  where ds.name = v_name
  limit 1;
  if v_raw is null or trim(v_raw) = '' then
    return null;
  end if;
  return v_raw::jsonb;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.pco_vault_get(uuid) from public, anon, authenticated;
grant execute on function public.pco_vault_get(uuid) to service_role;

create or replace function public.pco_vault_delete(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_name text;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id required';
  end if;
  v_name := public.pco_vault_secret_name(p_tenant_id);
  delete from vault.secrets s where s.name = v_name;

  update public.tenant_integrations
  set
    pco_enabled = false,
    pco_configured_at = null,
    pco_app_id_last4 = null,
    updated_at = now()
  where tenant_id = p_tenant_id;

  update public.tenant_memberships
  set planning_center_list_id = null
  where tenant_id = p_tenant_id;
end;
$$;

revoke all on function public.pco_vault_delete(uuid) from public, anon, authenticated;
grant execute on function public.pco_vault_delete(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4) wipe_church_tenant: remove Vault secret before tenant delete
-- ---------------------------------------------------------------------------

create or replace function public.wipe_church_tenant(
  p_tenant_id uuid,
  p_confirm_slug text,
  p_wiped_by_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
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
  v_vault_name text;
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

  v_vault_name := public.pco_vault_secret_name(p_tenant_id);
  delete from vault.secrets s where s.name = v_vault_name;

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
