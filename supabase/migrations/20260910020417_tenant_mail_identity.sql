-- Per-tenant outbound email identity (display name + local-part on the platform
-- Resend domain, optional church Reply-To). Full custom sending domains are later.
-- Local-part (not a full From address) is stored so From cannot leave MAIL_SENDER_ADDRESS's domain.

alter table public.tenant_settings
  add column if not exists mail_from_name text,
  add column if not exists mail_from_local_part text,
  add column if not exists mail_reply_to text;

alter table public.tenant_settings
  drop constraint if exists tenant_settings_mail_from_name_format;
alter table public.tenant_settings
  add constraint tenant_settings_mail_from_name_format
  check (
    mail_from_name is null
    or (
      char_length(btrim(mail_from_name)) between 1 and 78
      and mail_from_name !~ E'[<>\\n\\r]'
    )
  );

alter table public.tenant_settings
  drop constraint if exists tenant_settings_mail_from_local_part_format;
alter table public.tenant_settings
  add constraint tenant_settings_mail_from_local_part_format
  check (
    mail_from_local_part is null
    or mail_from_local_part ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'
  );

alter table public.tenant_settings
  drop constraint if exists tenant_settings_mail_reply_to_format;
alter table public.tenant_settings
  add constraint tenant_settings_mail_reply_to_format
  check (
    mail_reply_to is null
    or (
      char_length(mail_reply_to) <= 254
      and mail_reply_to !~ E'[<>\\n\\r\\s]'
      and mail_reply_to ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    )
  );

comment on column public.tenant_settings.mail_from_name is
  'Optional Resend From display name for this church. Null uses Edge MAIL_FROM_NAME.';
comment on column public.tenant_settings.mail_from_local_part is
  'Optional From local-part on the platform verified Resend domain (e.g. crosspointe → crosspointe@{MAIL_SENDER_ADDRESS domain}). Null uses MAIL_SENDER_ADDRESS.';
comment on column public.tenant_settings.mail_reply_to is
  'Optional Reply-To (church inbox; need not be on the Resend domain). Null omits Reply-To.';

create or replace function public.get_tenant_mail_identity(
  p_tenant_id uuid,
  p_email text default null
)
returns table (
  mail_from_name text,
  mail_from_local_part text,
  mail_reply_to text
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
    ts.mail_from_name,
    ts.mail_from_local_part,
    ts.mail_reply_to
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
end;
$$;

create or replace function public.update_tenant_mail_identity(
  p_tenant_id uuid,
  p_mail_from_name text default null,
  p_mail_from_local_part text default null,
  p_mail_reply_to text default null,
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
  v_name text := nullif(btrim(coalesce(p_mail_from_name, '')), '');
  v_local text := nullif(lower(btrim(coalesce(p_mail_from_local_part, ''))), '');
  v_reply text := nullif(lower(btrim(coalesce(p_mail_reply_to, ''))), '');
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

  if v_name is not null
     and (
       char_length(v_name) > 78
       or v_name ~ E'[<>\\n\\r]'
     ) then
    raise exception 'Invalid mail_from_name';
  end if;

  if v_local is not null
     and v_local !~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$' then
    raise exception 'Invalid mail_from_local_part';
  end if;

  if v_reply is not null
     and (
       char_length(v_reply) > 254
       or v_reply ~ E'[<>\\n\\r\\s]'
       or v_reply !~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
     ) then
    raise exception 'Invalid mail_reply_to';
  end if;

  insert into public.tenant_settings (
    tenant_id,
    mail_from_name,
    mail_from_local_part,
    mail_reply_to,
    updated_at
  )
  values (
    p_tenant_id,
    v_name,
    v_local,
    v_reply,
    now()
  )
  on conflict (tenant_id) do update set
    mail_from_name = excluded.mail_from_name,
    mail_from_local_part = excluded.mail_from_local_part,
    mail_reply_to = excluded.mail_reply_to,
    updated_at = excluded.updated_at;
end;
$$;

comment on function public.get_tenant_mail_identity(uuid, text) is
  'Tenant admin / super_admin: read this church''s outbound mail identity overrides.';
comment on function public.update_tenant_mail_identity(uuid, text, text, text, text) is
  'Tenant admin / super_admin: set this church''s From name, local-part, and optional Reply-To. Empty values clear to platform MAIL_* fallback.';

grant execute on function public.get_tenant_mail_identity(uuid, text) to anon, authenticated;
grant execute on function public.update_tenant_mail_identity(uuid, text, text, text, text) to anon, authenticated;
