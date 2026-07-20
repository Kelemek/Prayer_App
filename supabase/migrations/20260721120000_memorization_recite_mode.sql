-- Memorization Recite mode: tenant settings, usage ledger, and RPCs.

alter table public.tenant_settings
  add column if not exists memorization_recite_enabled boolean not null default false,
  add column if not exists memorization_recite_stt_provider text not null default 'browser',
  add column if not exists memorization_recite_whisper_model text not null default 'whisper-1';

alter table public.tenant_settings
  drop constraint if exists tenant_settings_memorization_recite_stt_provider_check;

alter table public.tenant_settings
  add constraint tenant_settings_memorization_recite_stt_provider_check
  check (memorization_recite_stt_provider in ('browser', 'whisper'));

alter table public.tenant_settings
  drop constraint if exists tenant_settings_memorization_recite_whisper_model_check;

alter table public.tenant_settings
  add constraint tenant_settings_memorization_recite_whisper_model_check
  check (memorization_recite_whisper_model in ('whisper-1', 'gpt-4o-mini-transcribe'));

comment on column public.tenant_settings.memorization_recite_stt_provider is
  'STT backend for Recite mode: browser (free Web Speech) or whisper (OpenAI API).';

comment on column public.tenant_settings.memorization_recite_whisper_model is
  'OpenAI audio transcription model when memorization_recite_stt_provider is whisper.';

-- whisper-1 rate snapshot reference: $0.006/min as of plan v1
create table if not exists public.memorization_recite_usage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_email text not null,
  memorized_item_id uuid references public.memorized_items(id) on delete set null,
  stt_provider text not null check (stt_provider in ('browser', 'whisper')),
  audio_seconds numeric(12, 3) not null default 0 check (audio_seconds >= 0),
  model text not null,
  rate_usd_per_minute numeric(10, 6) not null default 0,
  estimated_cost_usd numeric(10, 6) not null default 0,
  billable boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists memorization_recite_usage_tenant_created_idx
  on public.memorization_recite_usage (tenant_id, created_at desc);

alter table public.memorization_recite_usage enable row level security;

drop policy if exists memorization_recite_usage_tenant_admin_select on public.memorization_recite_usage;
create policy memorization_recite_usage_tenant_admin_select
  on public.memorization_recite_usage
  for select
  to authenticated, anon
  using (
    public.is_tenant_admin(tenant_id, lower(trim(coalesce(auth.jwt() ->> 'email', ''))))
    or public.is_super_admin(lower(trim(coalesce(auth.jwt() ->> 'email', ''))))
  );

-- ----- Settings RPCs -----

create or replace function public.get_tenant_memorization_recite_settings(
  p_tenant_id uuid,
  p_email text default null
)
returns table (
  memorization_recite_enabled boolean,
  memorization_recite_stt_provider text,
  memorization_recite_whisper_model text
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
    ts.memorization_recite_enabled,
    ts.memorization_recite_stt_provider,
    ts.memorization_recite_whisper_model
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
end;
$$;

create or replace function public.update_tenant_memorization_recite_settings(
  p_tenant_id uuid,
  p_memorization_recite_enabled boolean,
  p_memorization_recite_stt_provider text,
  p_email text default null,
  p_memorization_recite_whisper_model text default 'whisper-1'
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
  v_provider text := lower(trim(coalesce(p_memorization_recite_stt_provider, 'browser')));
  v_model text := lower(trim(coalesce(p_memorization_recite_whisper_model, 'whisper-1')));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  if v_provider not in ('browser', 'whisper') then
    raise exception 'Invalid stt provider';
  end if;

  if v_model not in ('whisper-1', 'gpt-4o-mini-transcribe') then
    raise exception 'Invalid whisper model';
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
    memorization_recite_enabled,
    memorization_recite_stt_provider,
    memorization_recite_whisper_model,
    updated_at
  )
  values (
    p_tenant_id,
    coalesce(p_memorization_recite_enabled, false),
    v_provider,
    v_model,
    now()
  )
  on conflict (tenant_id) do update set
    memorization_recite_enabled = excluded.memorization_recite_enabled,
    memorization_recite_stt_provider = excluded.memorization_recite_stt_provider,
    memorization_recite_whisper_model = excluded.memorization_recite_whisper_model,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.get_public_tenant_memorization_recite_settings(p_tenant_id uuid)
returns table (
  memorization_recite_enabled boolean,
  memorization_recite_stt_provider text,
  memorization_recite_whisper_model text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ts.memorization_recite_enabled,
    ts.memorization_recite_stt_provider,
    ts.memorization_recite_whisper_model
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
$$;

-- ----- Usage summary (tenant admin) -----

create or replace function public.get_tenant_memorization_recite_usage_summary(
  p_tenant_id uuid,
  p_email text default null,
  p_start timestamptz default date_trunc('month', now()),
  p_end timestamptz default now()
)
returns table (
  attempt_count bigint,
  whisper_attempt_count bigint,
  browser_attempt_count bigint,
  total_audio_seconds numeric,
  billable_audio_seconds numeric,
  estimated_cost_usd numeric
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
    count(*)::bigint,
    count(*) filter (where u.stt_provider = 'whisper')::bigint,
    count(*) filter (where u.stt_provider = 'browser')::bigint,
    coalesce(sum(u.audio_seconds), 0),
    coalesce(sum(u.audio_seconds) filter (where u.billable), 0),
    coalesce(sum(u.estimated_cost_usd) filter (where u.billable), 0)
  from public.memorization_recite_usage u
  where u.tenant_id = p_tenant_id
    and u.created_at >= coalesce(p_start, '-infinity'::timestamptz)
    and u.created_at < coalesce(p_end, 'infinity'::timestamptz);
end;
$$;

-- ----- Browser usage log (authenticated member) -----

create or replace function public.log_memorization_recite_usage(
  p_tenant_id uuid,
  p_memorized_item_id uuid,
  p_stt_provider text,
  p_audio_seconds numeric,
  p_model text default 'browser-speech'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_provider text := lower(trim(coalesce(p_stt_provider, 'browser')));
  v_seconds numeric := least(180, greatest(0, coalesce(p_audio_seconds, 0)));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  v_email := nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '');
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not public.is_login_allowed_email(v_email) then
    raise exception 'Not authorized';
  end if;

  if not public.is_tenant_member(p_tenant_id, v_email) then
    raise exception 'Not a member of this organization';
  end if;

  if v_provider != 'browser' then
    raise exception 'Client may only log browser usage';
  end if;

  if not exists (
    select 1 from public.tenant_settings ts
    where ts.tenant_id = p_tenant_id
      and ts.memorization_recite_enabled = true
      and ts.memorization_recite_stt_provider = 'browser'
  ) then
    raise exception 'Recite browser STT not enabled for tenant';
  end if;

  insert into public.memorization_recite_usage (
    tenant_id,
    user_email,
    memorized_item_id,
    stt_provider,
    audio_seconds,
    model,
    rate_usd_per_minute,
    estimated_cost_usd,
    billable
  )
  values (
    p_tenant_id,
    v_email,
    p_memorized_item_id,
    'browser',
    v_seconds,
    coalesce(nullif(trim(p_model), ''), 'browser-speech'),
    0,
    0,
    false
  );
end;
$$;

grant execute on function public.get_tenant_memorization_recite_settings(uuid, text) to anon, authenticated;
grant execute on function public.update_tenant_memorization_recite_settings(uuid, boolean, text, text, text) to anon, authenticated;
grant execute on function public.get_public_tenant_memorization_recite_settings(uuid) to anon, authenticated;
grant execute on function public.get_tenant_memorization_recite_usage_summary(uuid, text, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.log_memorization_recite_usage(uuid, uuid, text, numeric, text) to authenticated;
