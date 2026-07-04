-- Tenant-scoped prayer types: per-tenant name uniqueness + default seed helper.

alter table public.prayer_types drop constraint if exists prayer_types_name_key;
drop index if exists public.prayer_types_name_key;

create unique index if not exists prayer_types_tenant_name_key
  on public.prayer_types (tenant_id, name);

create or replace function public.ensure_tenant_prayer_types(
  p_tenant_id uuid,
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
  def_id uuid;
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

  select id into def_id from public.tenants where slug = 'default-tenant' limit 1;
  if def_id is not null and def_id != p_tenant_id then
    insert into public.prayer_types (tenant_id, name, display_order, is_active)
    select
      p_tenant_id,
      src.name,
      src.display_order,
      src.is_active
    from public.prayer_types src
    where src.tenant_id = def_id
      and not exists (
        select 1
        from public.prayer_types existing
        where existing.tenant_id = p_tenant_id
          and existing.name = src.name
      );
  end if;

  if not exists (select 1 from public.prayer_types pt where pt.tenant_id = p_tenant_id) then
    insert into public.prayer_types (tenant_id, name, display_order, is_active)
    values
      (p_tenant_id, 'Healing', 0, true),
      (p_tenant_id, 'Guidance', 1, true),
      (p_tenant_id, 'Thanksgiving', 2, true),
      (p_tenant_id, 'Protection', 3, true),
      (p_tenant_id, 'Family', 4, true),
      (p_tenant_id, 'Finances', 5, true),
      (p_tenant_id, 'Salvation', 6, true),
      (p_tenant_id, 'Missions', 7, true),
      (p_tenant_id, 'Other', 8, true);
  end if;
end;
$$;

grant execute on function public.ensure_tenant_prayer_types(uuid, text) to anon, authenticated;

-- Seed default prayer types when a new tenant is created.
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

  insert into public.prayer_types (tenant_id, name, display_order, is_active)
  select
    new.id,
    src.name,
    src.display_order,
    src.is_active
  from public.prayer_types src
  where src.tenant_id = def_id
    and not exists (
      select 1
      from public.prayer_types existing
      where existing.tenant_id = new.id
        and existing.name = src.name
    );

  if not exists (select 1 from public.prayer_types pt where pt.tenant_id = new.id) then
    insert into public.prayer_types (tenant_id, name, display_order, is_active)
    values
      (new.id, 'Healing', 0, true),
      (new.id, 'Guidance', 1, true),
      (new.id, 'Thanksgiving', 2, true),
      (new.id, 'Protection', 3, true),
      (new.id, 'Family', 4, true),
      (new.id, 'Finances', 5, true),
      (new.id, 'Salvation', 6, true),
      (new.id, 'Missions', 7, true),
      (new.id, 'Other', 8, true);
  end if;

  return new;
end;
$$;
