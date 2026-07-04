-- Tighten RLS for Supabase Auth JWT sessions (authenticated role).

-- personal_prayers: replace permissive policy
drop policy if exists "Allow all personal_prayers access" on public.personal_prayers;

create policy personal_prayers_select_own on public.personal_prayers
  for select to authenticated
  using (
    lower(user_email) = public.current_user_email()
    or public.is_super_admin()
  );

create policy personal_prayers_insert_own on public.personal_prayers
  for insert to authenticated
  with check (
    lower(user_email) = public.current_user_email()
    or public.is_super_admin()
  );

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

create policy personal_prayers_delete_own on public.personal_prayers
  for delete to authenticated
  using (
    lower(user_email) = public.current_user_email()
    or public.is_super_admin()
  );

-- prayers insert: authenticated members (keep row-email policy for service edge cases during transition)
drop policy if exists tenant_insert_prayers on public.prayers;
create policy tenant_insert_prayers on public.prayers
  for insert to authenticated
  with check (
    public.is_tenant_member(tenant_id)
    and public.tenant_plan(tenant_id) in ('groups', 'churches')
  );

drop policy if exists tenant_read_prayers on public.prayers;
create policy tenant_read_prayers on public.prayers
  for select to authenticated
  using (
    public.is_tenant_member(tenant_id)
    and public.tenant_plan(tenant_id) in ('groups', 'churches')
  );

drop policy if exists tenant_update_prayers on public.prayers;
create policy tenant_update_prayers on public.prayers
  for update to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

drop policy if exists tenant_read_prayer_updates on public.prayer_updates;
create policy tenant_read_prayer_updates on public.prayer_updates
  for select to authenticated
  using (
    public.is_tenant_member(tenant_id)
    and public.tenant_plan(tenant_id) in ('groups', 'churches')
  );

drop policy if exists tenant_insert_prayer_updates on public.prayer_updates;
create policy tenant_insert_prayer_updates on public.prayer_updates
  for insert to authenticated
  with check (
    public.is_tenant_member(tenant_id)
    and public.tenant_plan(tenant_id) in ('groups', 'churches')
  );

drop policy if exists tenant_update_prayer_updates on public.prayer_updates;
create policy tenant_update_prayer_updates on public.prayer_updates
  for update to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- tenant_memberships: members can read own rows
drop policy if exists tenant_read_memberships on public.tenant_memberships;
create policy tenant_read_memberships on public.tenant_memberships
  for select using (
    lower(user_email) = public.current_user_email()
    or public.is_tenant_admin(tenant_id)
    or public.is_super_admin()
  );

-- Members update own profile via existing tenant_update policies or service role; role changes stay admin-only.
