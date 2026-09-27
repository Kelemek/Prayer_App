-- Close signed-in RLS gaps on personal_prayers, personal_prayer_updates, backup_logs, admin_settings.
--
-- Root cause: Postgres OR-combines PERMISSIVE policies. Legacy broad policies (auth.uid() IS NOT NULL,
-- auth.role() = 'authenticated', USING (true)) were never dropped when narrow own-row policies were added,
-- so any signed-in user (or anon on some tables) could read and mutate rows they do not own.
--
-- Do not apply until Mark asks.
-- After apply: treat the GitHub PAT and test-account codes as leaked; Mark must rotate them.

-- ---------------------------------------------------------------------------
-- 1. personal_prayers — drop legacy permissive policies; keep _own + admin read
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can delete personal prayers" on public.personal_prayers;
drop policy if exists "Authenticated users can insert personal prayers" on public.personal_prayers;
drop policy if exists "Authenticated users can select personal prayers" on public.personal_prayers;
drop policy if exists "Authenticated users can update personal prayers" on public.personal_prayers;
drop policy if exists "Users can delete their own personal prayers" on public.personal_prayers;
drop policy if exists "Users can insert their own personal prayers" on public.personal_prayers;
drop policy if exists "Users can update their own personal prayers" on public.personal_prayers;
drop policy if exists "Users can see their own personal prayers" on public.personal_prayers;
drop policy if exists "Allow all personal_prayers access" on public.personal_prayers;

-- Ensure own-row policies exist (idempotent; prayer-paid already has these from 20260416130000).
drop policy if exists personal_prayers_select_own on public.personal_prayers;
create policy personal_prayers_select_own on public.personal_prayers
  for select to authenticated
  using (
    lower(user_email) = public.current_user_email()
    or public.is_super_admin()
  );

drop policy if exists personal_prayers_insert_own on public.personal_prayers;
create policy personal_prayers_insert_own on public.personal_prayers
  for insert to authenticated
  with check (
    lower(user_email) = public.current_user_email()
    or public.is_super_admin()
  );

drop policy if exists personal_prayers_update_own on public.personal_prayers;
create policy personal_prayers_update_own on public.personal_prayers
  for update to authenticated
  using (
    lower(user_email) = public.current_user_email()
    or public.is_super_admin()
  )
  with check (
    lower(user_email) = public.current_user_email()
    or public.is_super_admin()
  );

drop policy if exists personal_prayers_delete_own on public.personal_prayers;
create policy personal_prayers_delete_own on public.personal_prayers
  for delete to authenticated
  using (
    lower(user_email) = public.current_user_email()
    or public.is_super_admin()
  );

revoke all on table public.personal_prayers from public, anon;
revoke truncate on table public.personal_prayers from authenticated;
grant select, insert, update, delete on table public.personal_prayers to authenticated;

-- ---------------------------------------------------------------------------
-- 2. personal_prayer_updates — drop open / auth.uid() policies; keep own + admin read
-- ---------------------------------------------------------------------------

drop policy if exists "Allow all personal_prayer_updates access" on public.personal_prayer_updates;
drop policy if exists "Authenticated users can select personal prayer updates" on public.personal_prayer_updates;
drop policy if exists "Authenticated users can insert personal prayer updates" on public.personal_prayer_updates;
drop policy if exists "Authenticated users can update personal prayer updates" on public.personal_prayer_updates;
drop policy if exists "Authenticated users can delete personal prayer updates" on public.personal_prayer_updates;

revoke all on table public.personal_prayer_updates from public, anon;
revoke truncate on table public.personal_prayer_updates from authenticated;
grant select, insert, update, delete on table public.personal_prayer_updates to authenticated;

-- ---------------------------------------------------------------------------
-- 3. backup_logs — super-admin read/insert only (service role bypasses RLS for nightly job)
-- ---------------------------------------------------------------------------

drop policy if exists "Allow all deletes" on public.backup_logs;
drop policy if exists "Allow all inserts" on public.backup_logs;
drop policy if exists "Allow all updates" on public.backup_logs;
drop policy if exists "Allow public reads" on public.backup_logs;
drop policy if exists "Anyone can read backup logs" on public.backup_logs;
drop policy if exists "Service role can insert backup logs" on public.backup_logs;

drop policy if exists backup_logs_select_super_admin on public.backup_logs;
drop policy if exists backup_logs_insert_super_admin on public.backup_logs;

create policy backup_logs_select_super_admin on public.backup_logs
  for select to authenticated
  using (public.is_super_admin());

create policy backup_logs_insert_super_admin on public.backup_logs
  for insert to authenticated
  with check (public.is_super_admin());

revoke all on table public.backup_logs from public, anon;
revoke update, delete, truncate on table public.backup_logs from authenticated;
grant select, insert on table public.backup_logs to authenticated;

-- ---------------------------------------------------------------------------
-- 4. admin_settings — no broad SELECT; super-admin FOR ALL policy remains
-- ---------------------------------------------------------------------------

drop policy if exists admin_settings_select_authenticated on public.admin_settings;

revoke all on table public.admin_settings from public, anon;
revoke delete, truncate on table public.admin_settings from authenticated;
grant select, insert, update on table public.admin_settings to authenticated;

-- GitHub PAT columns (idempotent with 20260913160000_restrict_github_feedback_columns.sql)
alter table public.admin_settings
  drop column if exists github_token,
  drop column if exists github_repo_owner,
  drop column if exists github_repo_name,
  drop column if exists enabled;

comment on table public.admin_settings is
  'Platform-global singleton (id=1). Super-admin writes only. In-app feedback uses Edge secret NOTION_TOKEN (submit-feedback). Kept: test_account_email, test_account_code_4/6/8, church billing knobs, id, created_at, updated_at. Church config lives on tenant_settings.';

alter table public.tenant_settings
  drop column if exists github_token,
  drop column if exists github_repo_owner,
  drop column if exists github_repo_name,
  drop column if exists github_feedback_enabled;

-- Tenant admins (manual broadcast) and super admins may read excluded test email via RPC only.
create or replace function public.get_broadcast_excluded_test_account_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_super_admin()
      or exists (
        select 1
        from public.tenant_memberships tm
        where tm.user_email = public.current_user_email()
          and tm.role = 'tenant_admin'
      )
    then (
      select lower(trim(s.test_account_email))
      from public.admin_settings s
      where s.id = 1
    )
    else null
  end;
$$;

revoke all on function public.get_broadcast_excluded_test_account_email() from public, anon;
grant execute on function public.get_broadcast_excluded_test_account_email() to authenticated;
