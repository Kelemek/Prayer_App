-- Allow authenticated users to create tenants and bootstrap their own tenant_admin membership.
-- Without these policies, client-side createTenant() cannot insert into tenants or memberships.

drop policy if exists tenant_read_tenants on public.tenants;
create policy tenant_read_tenants on public.tenants
for select using (
  public.is_tenant_member(id)
  or public.is_super_admin()
  or coalesce(lower(created_by_email), '') = public.current_user_email()
);

create policy tenant_insert_tenants on public.tenants
for insert with check (
  coalesce(lower(created_by_email), '') = public.current_user_email()
);

create policy tenant_insert_memberships_creator_bootstrap on public.tenant_memberships
for insert with check (
  exists (
    select 1
    from public.tenants t
    where t.id = tenant_id
      and coalesce(lower(t.created_by_email), '') = public.current_user_email()
  )
  and lower(user_email) = public.current_user_email()
  and role = 'tenant_admin'::public.tenant_membership_role
);
