-- Saddle-stitch booklet: prayer type inclusion flag + tenant-scoped custom insert pages.

alter table public.prayer_types
  add column if not exists include_in_booklet boolean not null default false;

comment on column public.prayer_types.include_in_booklet is
  'When true and the type is active, prompts of this category may appear in the admin saddle-stitch booklet (Tools).';

create table if not exists public.booklet_insert_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sort_order integer not null,
  label text,
  mime_type text not null,
  image_data text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booklet_insert_pages_mime_type_check check (
    mime_type in ('image/png', 'image/jpeg')
  )
);

create index if not exists booklet_insert_pages_tenant_sort_idx
  on public.booklet_insert_pages (tenant_id, sort_order);

comment on table public.booklet_insert_pages is
  'Admin-uploaded PNG/JPEG pages inserted into saddle-stitch booklet after answered prayers (per tenant).';

alter table public.booklet_insert_pages enable row level security;

grant select, insert, update, delete on public.booklet_insert_pages to anon, authenticated;
grant all on public.booklet_insert_pages to service_role;

drop policy if exists booklet_insert_pages_tenant_read on public.booklet_insert_pages;
drop policy if exists booklet_insert_pages_tenant_write on public.booklet_insert_pages;

create policy booklet_insert_pages_tenant_read on public.booklet_insert_pages
  for select
  using (
    public.is_tenant_member(tenant_id)
    or public.is_super_admin()
  );

create policy booklet_insert_pages_tenant_write on public.booklet_insert_pages
  for all
  using (
    public.is_tenant_admin(tenant_id)
    or public.is_super_admin()
  )
  with check (
    public.is_tenant_admin(tenant_id)
    or public.is_super_admin()
  );
