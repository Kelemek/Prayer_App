-- Prefer explicit p_email for MFA admin sessions when JWT identity is missing or not tenant-admin.

create or replace function public.get_tenant_reminder_settings(
  p_tenant_id uuid,
  p_email text default null
)
returns table (
  enable_reminders boolean,
  reminder_interval_days integer,
  enable_auto_archive boolean,
  days_before_archive integer
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
    ts.enable_reminders,
    ts.reminder_interval_days,
    ts.enable_auto_archive,
    ts.days_before_archive
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
end;
$$;

create or replace function public.update_tenant_reminder_settings(
  p_tenant_id uuid,
  p_enable_reminders boolean,
  p_reminder_interval_days integer,
  p_enable_auto_archive boolean,
  p_days_before_archive integer,
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
    enable_reminders,
    reminder_interval_days,
    enable_auto_archive,
    days_before_archive,
    updated_at
  )
  values (
    p_tenant_id,
    coalesce(p_enable_reminders, false),
    greatest(1, least(90, coalesce(p_reminder_interval_days, 7))),
    coalesce(p_enable_auto_archive, false),
    greatest(1, least(90, coalesce(p_days_before_archive, 7))),
    now()
  )
  on conflict (tenant_id) do update set
    enable_reminders = excluded.enable_reminders,
    reminder_interval_days = excluded.reminder_interval_days,
    enable_auto_archive = excluded.enable_auto_archive,
    days_before_archive = excluded.days_before_archive,
    updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.get_tenant_reminder_settings(uuid, text) to anon, authenticated;
grant execute on function public.update_tenant_reminder_settings(uuid, boolean, integer, boolean, integer, text) to anon, authenticated;
