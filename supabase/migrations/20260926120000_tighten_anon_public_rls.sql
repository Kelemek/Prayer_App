-- P9: drop publishable-key (anon / public USING true) access on sensitive tables.
-- Signed-in app traffic uses Supabase Auth email OTP, so the same client already
-- sends a user JWT. Authenticated own-row policies on device tokens and reminders
-- stay in place. Service role (Edge Functions, erase/export) bypasses RLS.
-- status_change_requests was dropped in 20260123140820_remote_schema.sql
-- (former 20260201_drop_status_change_requests.sql); no policies remain to tighten.

-- ---------------------------------------------------------------------------
-- device_tokens: authenticated user manages only their own rows
-- (device_tokens_*_own from 20260123140820_remote_schema.sql)
-- ---------------------------------------------------------------------------

drop policy if exists "device_tokens_anon_all" on public.device_tokens;

revoke all on table public.device_tokens from public, anon;
revoke truncate on table public.device_tokens from authenticated;

-- ---------------------------------------------------------------------------
-- Hourly and per-item reminders: keep authenticated own-row policies
-- ---------------------------------------------------------------------------

drop policy if exists "anon_user_prayer_hour_reminders_mfa_access" on public.user_prayer_hour_reminders;
drop policy if exists "Allow all user_prayer_hour_reminders access" on public.user_prayer_hour_reminders;
revoke all on table public.user_prayer_hour_reminders from public, anon;
revoke truncate on table public.user_prayer_hour_reminders from authenticated;

drop policy if exists anon_user_memorization_hour_reminders_mfa_access on public.user_memorization_hour_reminders;
revoke all on table public.user_memorization_hour_reminders from public, anon;
revoke truncate on table public.user_memorization_hour_reminders from authenticated;

drop policy if exists anon_user_prayer_item_reminders_mfa_access on public.user_prayer_item_reminders;
revoke all on table public.user_prayer_item_reminders from public, anon;
revoke truncate on table public.user_prayer_item_reminders from authenticated;

-- ---------------------------------------------------------------------------
-- member prayer updates / pray-for counts (reverse 20260921130000 anon DML)
-- No owner column: any signed-in user may still CRUD rows and increment counts.
-- The publishable key alone may not.
-- ---------------------------------------------------------------------------

drop policy if exists "Allow all select on member_prayer_updates" on public.member_prayer_updates;
drop policy if exists "Allow all insert on member_prayer_updates" on public.member_prayer_updates;
drop policy if exists "Allow all update on member_prayer_updates" on public.member_prayer_updates;
drop policy if exists "Allow all delete on member_prayer_updates" on public.member_prayer_updates;

drop policy if exists member_prayer_updates_select_authenticated on public.member_prayer_updates;
create policy member_prayer_updates_select_authenticated
  on public.member_prayer_updates
  for select
  to authenticated
  using (true);

drop policy if exists member_prayer_updates_insert_authenticated on public.member_prayer_updates;
create policy member_prayer_updates_insert_authenticated
  on public.member_prayer_updates
  for insert
  to authenticated
  with check (true);

drop policy if exists member_prayer_updates_update_authenticated on public.member_prayer_updates;
create policy member_prayer_updates_update_authenticated
  on public.member_prayer_updates
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists member_prayer_updates_delete_authenticated on public.member_prayer_updates;
create policy member_prayer_updates_delete_authenticated
  on public.member_prayer_updates
  for delete
  to authenticated
  using (true);

revoke all on table public.member_prayer_updates from public, anon;
grant select, insert, update, delete on table public.member_prayer_updates to authenticated;
revoke truncate on table public.member_prayer_updates from authenticated;

drop policy if exists "Allow select on member_prayed_for_counts" on public.member_prayed_for_counts;
drop policy if exists member_prayed_for_counts_select_authenticated on public.member_prayed_for_counts;
create policy member_prayed_for_counts_select_authenticated
  on public.member_prayed_for_counts
  for select
  to authenticated
  using (true);

revoke all on table public.member_prayed_for_counts from public, anon;
grant select on table public.member_prayed_for_counts to authenticated;
revoke truncate on table public.member_prayed_for_counts from authenticated;

revoke all on function public.increment_member_prayed_for_count(text) from public, anon;
grant execute on function public.increment_member_prayed_for_count(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- verification_codes: Edge Functions send-verification-code and verify-code
-- use the service role. No client select/insert/update.
-- ---------------------------------------------------------------------------

drop policy if exists "Anyone can insert verification codes" on public.verification_codes;
drop policy if exists "Anyone can read verification codes" on public.verification_codes;
drop policy if exists "Anyone can update verification codes" on public.verification_codes;

revoke all on table public.verification_codes from public, anon, authenticated;

revoke all on function public.cleanup_expired_verification_codes() from public, anon, authenticated;
grant execute on function public.cleanup_expired_verification_codes() to service_role;

-- ---------------------------------------------------------------------------
-- update_deletion_requests: requester inserts/reads own row; tenant admins review
-- ---------------------------------------------------------------------------

drop policy if exists "Allow all operations on update_deletion_requests" on public.update_deletion_requests;

drop policy if exists update_deletion_requests_select_own_or_admin on public.update_deletion_requests;
create policy update_deletion_requests_select_own_or_admin
  on public.update_deletion_requests
  for select
  to authenticated
  using (
    public.current_user_email() <> ''
    and (
      public.is_tenant_admin(tenant_id)
      or lower(trim(coalesce(requested_email, ''))) = public.current_user_email()
    )
  );

drop policy if exists update_deletion_requests_insert_own on public.update_deletion_requests;
create policy update_deletion_requests_insert_own
  on public.update_deletion_requests
  for insert
  to authenticated
  with check (
    public.current_user_email() <> ''
    and lower(trim(coalesce(requested_email, ''))) = public.current_user_email()
    and public.is_tenant_member(tenant_id)
  );

drop policy if exists update_deletion_requests_update_admin on public.update_deletion_requests;
create policy update_deletion_requests_update_admin
  on public.update_deletion_requests
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

revoke all on table public.update_deletion_requests from public, anon;
grant select, insert, update on table public.update_deletion_requests to authenticated;
revoke delete, truncate on table public.update_deletion_requests from authenticated;
