-- Per-tenant branding, GitHub feedback, and prayer encouragement (mirrors admin_settings fields).

alter table public.tenant_settings
  add column if not exists app_title text default 'Church Prayer Manager',
  add column if not exists app_subtitle text default 'Keeping our community connected in prayer',
  add column if not exists use_logo boolean not null default false,
  add column if not exists light_mode_logo_blob text,
  add column if not exists dark_mode_logo_blob text,
  add column if not exists branding_last_modified timestamptz default now(),
  add column if not exists github_token text,
  add column if not exists github_repo_owner text default ''::text,
  add column if not exists github_repo_name text default ''::text,
  add column if not exists github_feedback_enabled boolean not null default false,
  add column if not exists prayer_encouragement_enabled boolean not null default false,
  add column if not exists prayer_encouragement_cooldown_hours integer not null default 4;

alter table public.tenant_settings
  drop constraint if exists tenant_settings_prayer_encouragement_cooldown_hours_range;

alter table public.tenant_settings
  add constraint tenant_settings_prayer_encouragement_cooldown_hours_range
  check (prayer_encouragement_cooldown_hours >= 1 and prayer_encouragement_cooldown_hours <= 168);

-- Seed every tenant from the global singleton so behavior matches pre-migration defaults.
update public.tenant_settings ts
set
  app_title = coalesce(a.app_title, ts.app_title),
  app_subtitle = coalesce(a.app_subtitle, ts.app_subtitle),
  use_logo = coalesce(a.use_logo, ts.use_logo),
  light_mode_logo_blob = a.light_mode_logo_blob,
  dark_mode_logo_blob = a.dark_mode_logo_blob,
  branding_last_modified = coalesce(a.branding_last_modified, ts.branding_last_modified),
  github_token = a.github_token,
  github_repo_owner = coalesce(nullif(a.github_repo_owner, ''), ts.github_repo_owner),
  github_repo_name = coalesce(nullif(a.github_repo_name, ''), ts.github_repo_name),
  github_feedback_enabled = coalesce(a.enabled, ts.github_feedback_enabled),
  prayer_encouragement_enabled = coalesce(a.prayer_encouragement_enabled, ts.prayer_encouragement_enabled),
  prayer_encouragement_cooldown_hours = coalesce(a.prayer_encouragement_cooldown_hours, ts.prayer_encouragement_cooldown_hours)
from public.admin_settings a
where a.id = 1;

create or replace function public.update_tenant_settings_branding_last_modified()
returns trigger
language plpgsql
as $$
begin
  if (
    old.use_logo is distinct from new.use_logo
    or old.light_mode_logo_blob is distinct from new.light_mode_logo_blob
    or old.dark_mode_logo_blob is distinct from new.dark_mode_logo_blob
    or old.app_title is distinct from new.app_title
    or old.app_subtitle is distinct from new.app_subtitle
  ) then
    new.branding_last_modified = now();
  end if;
  return new;
end;
$$;

drop trigger if exists tenant_settings_branding_modified_trigger on public.tenant_settings;

create trigger tenant_settings_branding_modified_trigger
before update on public.tenant_settings
for each row
execute function public.update_tenant_settings_branding_last_modified();
