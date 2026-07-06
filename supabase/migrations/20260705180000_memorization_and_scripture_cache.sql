-- Memorized verses/books per user per tenant + shared scripture API cache.

create table if not exists public.scripture_cache (
  reference text not null,
  translation text not null,
  text text not null,
  cached_at timestamptz not null default now(),
  primary key (reference, translation)
);

create index if not exists idx_scripture_cache_cached_at
  on public.scripture_cache (cached_at);

alter table public.scripture_cache enable row level security;

drop policy if exists scripture_cache_select_authenticated on public.scripture_cache;
create policy scripture_cache_select_authenticated on public.scripture_cache
  for select to authenticated
  using (true);

create table if not exists public.memorized_items (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  reference text not null,
  text text not null,
  translation text not null default 'esv',
  kind text not null default 'verse'
    check (kind in ('verse', 'bibleBooks')),
  bible_books_scope text
    check (bible_books_scope is null or bible_books_scope in ('all', 'ot', 'nt')),
  date_added timestamptz not null default now(),
  last_practiced_at timestamptz,
  practice_sessions jsonb not null default '[]'::jsonb,
  in_progress_practice jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memorized_items_kind_scope_consistency_check
    check (
      (kind = 'bibleBooks' and bible_books_scope is not null)
      or (kind = 'verse' and bible_books_scope is null)
    )
);

create unique index if not exists memorized_items_verse_unique
  on public.memorized_items (lower(user_email), tenant_id, reference, translation)
  where kind = 'verse';

create unique index if not exists memorized_items_bible_books_unique
  on public.memorized_items (lower(user_email), tenant_id, bible_books_scope)
  where kind = 'bibleBooks';

create index if not exists idx_memorized_items_user_tenant_date
  on public.memorized_items (lower(user_email), tenant_id, date_added desc);

alter table public.memorized_items enable row level security;

drop policy if exists memorized_items_select_own on public.memorized_items;
create policy memorized_items_select_own on public.memorized_items
  for select to authenticated
  using (
    (
      lower(user_email) = public.current_user_email()
      and public.is_tenant_member(tenant_id)
    )
    or public.is_super_admin()
  );

drop policy if exists memorized_items_insert_own on public.memorized_items;
create policy memorized_items_insert_own on public.memorized_items
  for insert to authenticated
  with check (
    (
      lower(user_email) = public.current_user_email()
      and public.is_tenant_member(tenant_id)
    )
    or public.is_super_admin()
  );

drop policy if exists memorized_items_update_own on public.memorized_items;
create policy memorized_items_update_own on public.memorized_items
  for update to authenticated
  using (
    (
      lower(user_email) = public.current_user_email()
      and public.is_tenant_member(tenant_id)
    )
    or public.is_super_admin()
  )
  with check (
    (
      lower(user_email) = public.current_user_email()
      and public.is_tenant_member(tenant_id)
    )
    or public.is_super_admin()
  );

drop policy if exists memorized_items_delete_own on public.memorized_items;
create policy memorized_items_delete_own on public.memorized_items
  for delete to authenticated
  using (
    (
      lower(user_email) = public.current_user_email()
      and public.is_tenant_member(tenant_id)
    )
    or public.is_super_admin()
  );

create or replace function public.touch_memorized_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memorized_items_updated_at on public.memorized_items;
create trigger memorized_items_updated_at
  before update on public.memorized_items
  for each row
  execute function public.touch_memorized_items_updated_at();
