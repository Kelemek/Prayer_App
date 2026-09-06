-- First-class personal prayer categories: name, chip order, and color live on
-- personal_categories. Prayer display_order is only order within a category.

create table if not exists public.personal_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_email text not null,
  name text not null,
  display_order integer not null default 0,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_categories_name_check check (
    char_length(name) > 0 and char_length(name) <= 50
  ),
  constraint personal_categories_color_check check (
    color is null or color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

create unique index if not exists personal_categories_tenant_user_name_uidx
  on public.personal_categories (tenant_id, lower(user_email), lower(name));

create index if not exists idx_personal_categories_tenant_email_order
  on public.personal_categories (tenant_id, lower(user_email), display_order);

comment on table public.personal_categories is
  'Per-user, per-tenant personal prayer categories (chip order, name, color).';

alter table public.personal_categories enable row level security;

revoke all on table public.personal_categories from anon;
grant select, insert, update, delete on table public.personal_categories to authenticated;
grant all on table public.personal_categories to service_role;

drop policy if exists personal_categories_select_own on public.personal_categories;
create policy personal_categories_select_own
  on public.personal_categories
  for select
  to authenticated
  using (
    (
      lower(user_email) = public.current_user_email()
      and public.is_tenant_member(tenant_id)
    )
    or public.is_super_admin()
  );

drop policy if exists personal_categories_insert_own on public.personal_categories;
create policy personal_categories_insert_own
  on public.personal_categories
  for insert
  to authenticated
  with check (
    (
      lower(user_email) = public.current_user_email()
      and public.is_tenant_member(tenant_id)
    )
    or public.is_super_admin()
  );

drop policy if exists personal_categories_update_own on public.personal_categories;
create policy personal_categories_update_own
  on public.personal_categories
  for update
  to authenticated
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

drop policy if exists personal_categories_delete_own on public.personal_categories;
create policy personal_categories_delete_own
  on public.personal_categories
  for delete
  to authenticated
  using (
    (
      lower(user_email) = public.current_user_email()
      and public.is_tenant_member(tenant_id)
    )
    or public.is_super_admin()
  );

create or replace function public.touch_personal_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists personal_categories_updated_at on public.personal_categories;
create trigger personal_categories_updated_at
  before update on public.personal_categories
  for each row
  execute function public.touch_personal_categories_updated_at();

alter table public.personal_prayers
  add column if not exists category_id uuid references public.personal_categories (id) on delete set null;

create index if not exists idx_personal_prayers_category_id
  on public.personal_prayers (category_id);

-- Backfill category rows from named prayers, ordered like today's chip sort
-- (min display_order descending).
with named as (
  select
    coalesce(p.tenant_id, public.default_tenant_id()) as tenant_id,
    lower(p.user_email) as user_email,
    trim(p.category) as name,
    min(p.display_order) as min_order
  from public.personal_prayers p
  where nullif(trim(p.category), '') is not null
  group by 1, 2, 3
),
ranked as (
  select
    tenant_id,
    user_email,
    name,
    min_order,
    row_number() over (
      partition by tenant_id, user_email
      order by min_order desc, name asc
    ) - 1 as chip_order
  from named
)
insert into public.personal_categories (tenant_id, user_email, name, display_order)
select tenant_id, user_email, name, chip_order
from ranked
on conflict (tenant_id, lower(user_email), lower(name)) do nothing;

insert into public.personal_categories (tenant_id, user_email, name, display_order, color)
select
  c.tenant_id,
  lower(c.user_email),
  c.category,
  coalesce(
    (
      select max(pc.display_order) + 1
      from public.personal_categories pc
      where pc.tenant_id = c.tenant_id
        and lower(pc.user_email) = lower(c.user_email)
    ),
    0
  ),
  c.color
from public.personal_prayer_category_colors c
where not exists (
  select 1
  from public.personal_categories pc
  where pc.tenant_id = c.tenant_id
    and lower(pc.user_email) = lower(c.user_email)
    and lower(pc.name) = lower(c.category)
)
on conflict (tenant_id, lower(user_email), lower(name)) do nothing;

update public.personal_categories pc
set color = c.color
from public.personal_prayer_category_colors c
where pc.tenant_id = c.tenant_id
  and lower(pc.user_email) = lower(c.user_email)
  and lower(pc.name) = lower(c.category)
  and pc.color is distinct from c.color;

update public.personal_prayers p
set category_id = pc.id
from public.personal_categories pc
where nullif(trim(p.category), '') is not null
  and pc.tenant_id = coalesce(p.tenant_id, public.default_tenant_id())
  and lower(pc.user_email) = lower(p.user_email)
  and lower(pc.name) = lower(trim(p.category));

-- Collapse range-encoded display_order to within-category ranks (higher = top).
with ranked as (
  select
    p.id,
    count(*) over (
      partition by coalesce(p.category_id::text, lower(p.user_email) || ':uncat')
    ) as cnt,
    row_number() over (
      partition by coalesce(p.category_id::text, lower(p.user_email) || ':uncat')
      order by (p.display_order % 1000) desc, p.created_at desc, p.id desc
    ) as rn
  from public.personal_prayers p
)
update public.personal_prayers p
set display_order = ranked.cnt - ranked.rn
from ranked
where p.id = ranked.id;

drop index if exists idx_personal_prayers_category;
drop index if exists personal_prayers_user_email_category_idx;

drop trigger if exists trg_purge_item_reminders_on_personal_answered
  on public.personal_prayers;

create or replace function public.trg_purge_item_reminders_on_personal_answered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_name text;
  v_old_name text;
begin
  select name into v_new_name
  from public.personal_categories
  where id = new.category_id;
  select name into v_old_name
  from public.personal_categories
  where id = old.category_id;
  if v_new_name is distinct from v_old_name and v_new_name = 'Answered' then
    perform public.purge_user_prayer_item_reminders('personal', new.id::text);
  end if;
  return new;
end;
$$;

create trigger trg_purge_item_reminders_on_personal_answered
  after update of category_id on public.personal_prayers
  for each row
  execute function public.trg_purge_item_reminders_on_personal_answered();

alter table public.personal_prayers drop column if exists category;

drop table if exists public.personal_prayer_category_colors;

drop function if exists public.swap_personal_prayer_categories(text, text, text);
drop function if exists public.swap_personal_prayer_categories(text, text, text, uuid);
drop function if exists public.reorder_personal_prayer_categories(text, text[]);
drop function if exists public.reorder_personal_prayer_categories(text, text[], uuid);
drop function if exists public.reorder_personal_prayers(text, text[], text);
drop function if exists public.reorder_personal_prayers(text, text[], text, uuid);

create or replace function public.ensure_personal_category(
  p_name text,
  p_tenant_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  v_name text := trim(coalesce(p_name, ''));
  v_id uuid;
  v_display_order integer;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  if p_tenant_id is null then
    raise exception 'tenant_id is required';
  end if;
  if v_name = '' then
    raise exception 'Category name is required';
  end if;
  if char_length(v_name) > 50 then
    v_name := left(v_name, 50);
  end if;
  if not public.is_tenant_member(p_tenant_id) and not public.is_super_admin() then
    raise exception 'Not a member of this organization';
  end if;

  select c.id
    into v_id
  from public.personal_categories c
  where c.tenant_id = p_tenant_id
    and lower(c.user_email) = lower(v_email)
    and lower(c.name) = lower(v_name)
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  select coalesce(max(c.display_order), -1) + 1
    into v_display_order
  from public.personal_categories c
  where c.tenant_id = p_tenant_id
    and lower(c.user_email) = lower(v_email);

  insert into public.personal_categories (
    tenant_id, user_email, name, display_order
  ) values (
    p_tenant_id, lower(v_email), v_name, v_display_order
  )
  on conflict (tenant_id, lower(user_email), lower(name)) do update
    set name = public.personal_categories.name
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.reorder_personal_categories(p_ordered_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  i integer;
  updated_count integer;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  if p_ordered_ids is null then
    raise exception 'p_ordered_ids must not be null';
  end if;

  for i in 1 .. coalesce(array_length(p_ordered_ids, 1), 0)
  loop
    update public.personal_categories
    set display_order = i - 1
    where id = p_ordered_ids[i]
      and lower(user_email) = lower(v_email);

    get diagnostics updated_count = row_count;
    if updated_count = 0 then
      raise exception 'Unknown or inaccessible category id %', p_ordered_ids[i];
    end if;
  end loop;
end;
$$;

create or replace function public.reorder_personal_prayers(
  p_category_id uuid,
  p_ordered_prayer_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  v_count integer;
  i integer;
  updated_count integer;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  if p_ordered_prayer_ids is null then
    raise exception 'p_ordered_prayer_ids must not be null';
  end if;

  v_count := coalesce(array_length(p_ordered_prayer_ids, 1), 0);

  for i in 1 .. v_count
  loop
    update public.personal_prayers
    set display_order = v_count - i,
        updated_at = now()
    where id = p_ordered_prayer_ids[i]
      and lower(user_email) = lower(v_email)
      and (
        (p_category_id is null and category_id is null)
        or category_id = p_category_id
      );

    get diagnostics updated_count = row_count;
    if updated_count = 0 then
      raise exception 'Unknown or inaccessible prayer id %', p_ordered_prayer_ids[i];
    end if;
  end loop;
end;
$$;

create or replace function public.rename_personal_category(
  p_id uuid,
  p_name text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  v_name text := trim(coalesce(p_name, ''));
  v_tenant uuid;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  if v_name = '' then
    raise exception 'Category name is required';
  end if;
  if char_length(v_name) > 50 then
    v_name := left(v_name, 50);
  end if;

  select tenant_id
    into v_tenant
  from public.personal_categories
  where id = p_id
    and lower(user_email) = lower(v_email);
  if v_tenant is null then
    raise exception 'Category not found';
  end if;

  if exists (
    select 1
    from public.personal_categories c
    where c.tenant_id = v_tenant
      and lower(c.user_email) = lower(v_email)
      and lower(c.name) = lower(v_name)
      and c.id <> p_id
  ) then
    raise exception 'Category "%" already exists', v_name;
  end if;

  update public.personal_categories
  set name = v_name
  where id = p_id
    and lower(user_email) = lower(v_email);
end;
$$;

create or replace function public.delete_personal_category(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  deleted_count integer;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  delete from public.personal_prayers
  where category_id = p_id
    and lower(user_email) = lower(v_email);

  delete from public.personal_categories
  where id = p_id
    and lower(user_email) = lower(v_email);

  get diagnostics deleted_count = row_count;
  if deleted_count = 0 then
    raise exception 'Category not found';
  end if;
end;
$$;

comment on function public.ensure_personal_category(text, uuid) is
  'Create or return the current user''s personal category by name for a tenant';
comment on function public.reorder_personal_categories(uuid[]) is
  'Set display_order for the current user''s personal categories by id list';
comment on function public.reorder_personal_prayers(uuid, uuid[]) is
  'Set within-category display_order (higher = top) for the current user''s prayers';
comment on function public.rename_personal_category(uuid, text) is
  'Rename a personal category owned by the current user';
comment on function public.delete_personal_category(uuid) is
  'Delete a personal category and its prayers for the current user';

grant execute on function public.ensure_personal_category(text, uuid)
  to authenticated, service_role;
grant execute on function public.reorder_personal_categories(uuid[])
  to authenticated, service_role;
grant execute on function public.reorder_personal_prayers(uuid, uuid[])
  to authenticated, service_role;
grant execute on function public.rename_personal_category(uuid, text)
  to authenticated, service_role;
grant execute on function public.delete_personal_category(uuid)
  to authenticated, service_role;
