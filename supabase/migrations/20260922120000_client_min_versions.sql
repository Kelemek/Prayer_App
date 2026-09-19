-- Platform-wide minimum client versions for the force-upgrade gate.
-- NULL / blank = no floor, so current web and native clients stay usable.

alter table public.admin_settings
  add column if not exists min_web_build text;

alter table public.admin_settings
  add column if not exists min_native_version text;

comment on column public.admin_settings.min_web_build is
  'Minimum web JS bundle version (semver or build number). NULL/empty = no web force-upgrade.';

comment on column public.admin_settings.min_native_version is
  'Minimum native app version (semver or build number). NULL/empty = no native force-upgrade.';

create or replace function public.get_public_client_min_versions()
returns table (
  min_web_build text,
  min_native_version text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    nullif(trim(a.min_web_build), ''),
    nullif(trim(a.min_native_version), '')
  from public.admin_settings a
  where a.id = 1;
$$;

comment on function public.get_public_client_min_versions() is
  'Anon-readable min web/native versions for the client upgrade gate. Unset values mean no floor.';

grant execute on function public.get_public_client_min_versions() to anon, authenticated;
