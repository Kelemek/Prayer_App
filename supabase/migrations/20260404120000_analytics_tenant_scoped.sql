-- Tenant-scoped analytics: column, index, RLS, and membership read for tenant admins (counts).

alter table public.analytics
  add column if not exists tenant_id uuid references public.tenants (id) on delete set null;

create index if not exists idx_analytics_tenant_created_at
  on public.analytics (tenant_id, created_at)
  where tenant_id is not null;

-- Tenant admins need to list all memberships for their tenant (e.g. analytics member counts).
create policy tenant_read_memberships_for_tenant_admins on public.tenant_memberships
  for select
  using (public.is_tenant_admin (tenant_id));

drop policy if exists "Allow anonymous inserts" on public.analytics;
drop policy if exists "Allow public reads" on public.analytics;

-- Logged-in users: page views with no active tenant use NULL; otherwise must be a member of that tenant.
create policy analytics_insert_authenticated on public.analytics
  for insert
  to authenticated
  with check (
    tenant_id is null
    or public.is_tenant_member (tenant_id)
  );

-- Stats in admin: tenant_admin (or super_admin) for scoped rows; legacy NULL rows visible only to super_admin.
create policy analytics_select_tenant_admin on public.analytics
  for select
  to authenticated
  using (
    (
      tenant_id is not null
      and public.is_tenant_admin (tenant_id)
    )
    or (
      tenant_id is null
      and public.is_super_admin ()
    )
  );
