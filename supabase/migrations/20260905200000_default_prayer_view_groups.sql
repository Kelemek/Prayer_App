alter table public.tenant_memberships
  drop constraint if exists tenant_memberships_default_prayer_view_check;

alter table public.tenant_memberships
  add constraint tenant_memberships_default_prayer_view_check
  check (default_prayer_view in ('current', 'personal', 'groups'));
