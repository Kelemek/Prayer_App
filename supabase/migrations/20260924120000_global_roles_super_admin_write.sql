-- Client Tenant Manager grants/revokes super_admin via upsert/delete on
-- public.global_roles. RLS previously had only global_roles_self_read, so every
-- write failed with "new row violates row-level security policy" even for an
-- existing JWT super_admin. Writes stay gated on is_super_admin() (JWT email).

drop policy if exists global_roles_insert_super_admin on public.global_roles;
drop policy if exists global_roles_update_super_admin on public.global_roles;
drop policy if exists global_roles_delete_super_admin on public.global_roles;

create policy global_roles_insert_super_admin
  on public.global_roles
  for insert
  to authenticated
  with check (public.is_super_admin());

create policy global_roles_update_super_admin
  on public.global_roles
  for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy global_roles_delete_super_admin
  on public.global_roles
  for delete
  to authenticated
  using (public.is_super_admin());
