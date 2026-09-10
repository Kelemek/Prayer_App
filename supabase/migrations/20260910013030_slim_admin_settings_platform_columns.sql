-- Slim public.admin_settings to the platform singleton still used by the app:
-- GitHub feedback repo + Apple/Android test account (+ id/timestamps).
-- Church-scoped knobs already live on tenant_settings; do not drop the table.

-- Branding trigger still references church columns in PL/pgSQL (no SQL dependency),
-- so drop it before DROP COLUMN or later updates would fail at runtime.
drop trigger if exists admin_settings_branding_modified_trigger on public.admin_settings;

-- Tenant branding uses update_tenant_settings_branding_last_modified instead.
drop function if exists public.update_branding_last_modified();

alter table public.admin_settings
  drop constraint if exists admin_settings_deletions_allowed_check,
  drop constraint if exists admin_settings_updates_allowed_check,
  drop constraint if exists admin_settings_verification_code_expiry_minutes_check,
  drop constraint if exists admin_settings_verification_code_length_check,
  drop constraint if exists db_heartbeat_interval_min,
  drop constraint if exists inactivity_timeout_min,
  drop constraint if exists max_session_duration_min,
  drop constraint if exists prayer_encouragement_cooldown_hours_range;

drop index if exists public.idx_admin_settings_permissions;

-- Drop every leftover column not in the keep set (covers out-of-band extras
-- such as church_website_url / rich_text_editors_enabled).
do $$
declare
  col text;
  keep text[] := array[
    'id',
    'created_at',
    'updated_at',
    'github_token',
    'github_repo_owner',
    'github_repo_name',
    'enabled',
    'test_account_email',
    'test_account_code_4',
    'test_account_code_6',
    'test_account_code_8'
  ];
begin
  for col in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'admin_settings'
      and not (c.column_name = any (keep))
    order by c.ordinal_position
  loop
    execute format(
      'alter table public.admin_settings drop column if exists %I cascade',
      col
    );
  end loop;
end
$$;

comment on table public.admin_settings is
  'Platform-global singleton (id=1). Super-admin writes only. Kept columns: github_token, github_repo_owner, github_repo_name, enabled, test_account_email, test_account_code_4/6/8, id, created_at, updated_at. Church config lives on tenant_settings.';

comment on column public.admin_settings.github_token is
  'Platform GitHub token for the shared SaaS feedback repo.';
comment on column public.admin_settings.github_repo_owner is
  'Owner of the shared SaaS GitHub feedback repository.';
comment on column public.admin_settings.github_repo_name is
  'Name of the shared SaaS GitHub feedback repository.';
comment on column public.admin_settings.enabled is
  'When true, in-app feedback may create GitHub issues in the platform repo.';
comment on column public.admin_settings.test_account_email is
  'Email of the account used for Apple/Android app testing; when set, no verification email is sent and codes come from test_account_code_4/6/8.';
comment on column public.admin_settings.test_account_code_4 is
  'Fixed MFA code for the platform test account when a 4-digit code is requested.';
comment on column public.admin_settings.test_account_code_6 is
  'Fixed MFA code for the platform test account when a 6-digit code is requested.';
comment on column public.admin_settings.test_account_code_8 is
  'Fixed MFA code for the platform test account when an 8-digit code is requested.';
