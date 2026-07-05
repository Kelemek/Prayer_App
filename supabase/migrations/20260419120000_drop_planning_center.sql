-- Remove legacy Planning Center schema (columns and member_prayer_updates).

-- member_prayer_updates
drop trigger if exists member_prayer_updates_update_timestamp on public.member_prayer_updates;
drop function if exists public.update_member_prayer_updates_timestamp();
drop table if exists public.member_prayer_updates;

-- tenant_memberships legacy columns
alter table public.tenant_memberships
  drop column if exists in_planning_center,
  drop column if exists planning_center_checked_at,
  drop column if exists planning_center_list_id;
