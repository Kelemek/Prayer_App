-- Members can save their own settings (badges, push, display name, and similar).
-- Admins keep the existing full-row update policy.
-- A before-update guard rejects member changes to role, block status, tenant, email, and other privileged columns.

create or replace function public.tenant_memberships_guard_member_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_super_admin() or public.is_tenant_admin(old.tenant_id) then
    return new;
  end if;

  -- Service role and other non-user sessions bypass RLS and must keep full updates.
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'authenticated'
     or public.current_user_email() = '' then
    return new;
  end if;

  if lower(old.user_email) is distinct from public.current_user_email() then
    raise exception 'membership update not allowed';
  end if;

  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or lower(new.user_email) is distinct from lower(old.user_email)
     or new.role is distinct from old.role
     or new.is_blocked is distinct from old.is_blocked
     or new.created_at is distinct from old.created_at
     or new.unsubscribe_token is distinct from old.unsubscribe_token
     or new.auth_user_id is distinct from old.auth_user_id
     or new.receive_admin_emails is distinct from old.receive_admin_emails
     or new.receive_admin_push is distinct from old.receive_admin_push
     or new.in_planning_center is distinct from old.in_planning_center
     or new.planning_center_checked_at is distinct from old.planning_center_checked_at
     or new.planning_center_list_id is distinct from old.planning_center_list_id
     or new.first_login_at is distinct from old.first_login_at
     or new.hourly_memorization_reminder_last_spotlight_key
        is distinct from old.hourly_memorization_reminder_last_spotlight_key
     or new.last_activity_date is distinct from old.last_activity_date
  then
    raise exception 'members cannot change privileged membership fields';
  end if;

  return new;
end;
$$;

drop trigger if exists tenant_memberships_guard_member_columns on public.tenant_memberships;
create trigger tenant_memberships_guard_member_columns
  before update on public.tenant_memberships
  for each row
  execute function public.tenant_memberships_guard_member_columns();

drop policy if exists tenant_update_own_membership_preferences on public.tenant_memberships;
create policy tenant_update_own_membership_preferences
  on public.tenant_memberships
  for update
  to authenticated
  using (
    public.current_user_email() <> ''
    and lower(user_email) = public.current_user_email()
  )
  with check (
    public.current_user_email() <> ''
    and lower(user_email) = public.current_user_email()
  );
