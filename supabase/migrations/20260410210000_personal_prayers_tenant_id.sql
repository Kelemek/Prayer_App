-- Scope personal_prayers to tenants so switching org shows the correct list.

alter table public.personal_prayers
  add column if not exists tenant_id uuid references public.tenants (id);

-- Assign each existing row to one of the user's memberships (deterministic: first tenant_id per email).
update public.personal_prayers pp
set tenant_id = sub.tenant_id
from (
  select distinct on (lower(user_email))
    lower(user_email) as email_norm,
    tenant_id
  from public.tenant_memberships
  order by lower(user_email), tenant_id
) sub
where pp.tenant_id is null
  and lower(pp.user_email) = sub.email_norm;

-- Orphans (no membership row): drop — avoids NULL tenant_id with NOT NULL.
delete from public.personal_prayers where tenant_id is null;

alter table public.personal_prayers
  alter column tenant_id set not null;

create index if not exists idx_personal_prayers_user_tenant
  on public.personal_prayers (lower(user_email), tenant_id);

drop policy if exists "Allow all personal_prayers access" on public.personal_prayers;

-- Reorder RPC: scope by tenant
drop function if exists public.reorder_personal_prayers (text, text[], text);

create or replace function public.reorder_personal_prayers (
  p_user_email text,
  p_ordered_prayer_ids text[],
  p_category text default null::text,
  p_tenant_id uuid default null
)
returns table (success boolean, message text)
language plpgsql
security definer
as $function$
declare
  v_prayer_id text;
  v_position integer;
  v_category text;
  v_range_min integer;
  v_range_max integer;
  v_new_display_order integer;
  v_updated_count integer := 0;
  v_prayer_count integer;
begin
  if p_user_email is null or p_user_email = '' then
    return query select false, 'User email is required';
    return;
  end if;

  if p_tenant_id is null then
    return query select false, 'tenant_id is required';
    return;
  end if;

  if p_ordered_prayer_ids is null or array_length(p_ordered_prayer_ids, 1) is null then
    return query select false, 'Prayer ID array is required';
    return;
  end if;

  if p_category is not null then
    v_category := p_category;
  else
    select category into v_category
    from personal_prayers
    where id = p_ordered_prayer_ids[1]::uuid
      and user_email = p_user_email
      and tenant_id = p_tenant_id
    limit 1;
  end if;

  select
    coalesce(min(display_order) / 1000 * 1000, 1000) as range_min,
    coalesce(min(display_order) / 1000 * 1000 + 999, 1999) as range_max
  into v_range_min, v_range_max
  from personal_prayers
  where user_email = p_user_email
    and tenant_id = p_tenant_id
    and (v_category is null or category = v_category);

  v_prayer_count := array_length(p_ordered_prayer_ids, 1);

  for v_position in 0..(v_prayer_count - 1) loop
    v_prayer_id := p_ordered_prayer_ids[v_position + 1];

    if v_prayer_id is null or v_prayer_id = '' then
      continue;
    end if;

    v_new_display_order := v_range_min + (v_prayer_count - 1 - v_position);

    update personal_prayers
    set display_order = v_new_display_order
    where id = v_prayer_id::uuid
      and user_email = p_user_email
      and tenant_id = p_tenant_id;

    v_updated_count := v_updated_count + 1;
  end loop;

  return query select true, format('Successfully reordered %s prayers', v_updated_count);
end;
$function$;

-- Category swap RPC: scope by tenant
drop function if exists public.swap_personal_prayer_categories (text, text, text);

create or replace function public.swap_personal_prayer_categories (
  p_user_email text,
  p_category_a text,
  p_category_b text,
  p_tenant_id uuid default null
)
returns table (success boolean, message text)
language plpgsql
security definer
as $function$
declare
  v_prefix_a integer;
  v_prefix_b integer;
  v_count_a integer;
  v_count_b integer;
begin
  if p_tenant_id is null then
    return query select false, 'tenant_id is required';
    return;
  end if;

  select
    floor(min(display_order) / 1000)::integer,
    count(*)
  into v_prefix_a, v_count_a
  from personal_prayers
  where user_email = p_user_email
    and tenant_id = p_tenant_id
    and category = p_category_a;

  select
    floor(min(display_order) / 1000)::integer,
    count(*)
  into v_prefix_b, v_count_b
  from personal_prayers
  where user_email = p_user_email
    and tenant_id = p_tenant_id
    and category = p_category_b;

  if v_prefix_a is null then
    return query select false, 'Category A not found: ' || p_category_a;
    return;
  end if;

  if v_prefix_b is null then
    return query select false, 'Category B not found: ' || p_category_b;
    return;
  end if;

  update personal_prayers
  set display_order = 999000 + (display_order % 1000)
  where user_email = p_user_email
    and tenant_id = p_tenant_id
    and category = p_category_a;

  update personal_prayers
  set display_order = (v_prefix_a * 1000) + (display_order % 1000)
  where user_email = p_user_email
    and tenant_id = p_tenant_id
    and category = p_category_b;

  update personal_prayers
  set display_order = (v_prefix_b * 1000) + (display_order % 1000)
  where user_email = p_user_email
    and tenant_id = p_tenant_id
    and category = p_category_a;

  return query select true,
    'Successfully swapped ' || v_count_a || ' prayers in ' || p_category_a ||
    ' with ' || v_count_b || ' prayers in ' || p_category_b;
end;
$function$;

-- Reorder category list RPC (toolbar): scope by tenant
drop function if exists public.reorder_personal_prayer_categories (text, text[]);

create or replace function public.reorder_personal_prayer_categories (
  p_user_email text,
  p_ordered_categories text[],
  p_tenant_id uuid default null
)
returns table (success boolean, message text)
language plpgsql
security definer
as $function$
declare
  v_category text;
  v_new_prefix integer;
  v_updated_count integer := 0;
  v_position integer;
begin
  if p_user_email is null or p_user_email = '' then
    return query select false, 'User email is required';
    return;
  end if;

  if p_tenant_id is null then
    return query select false, 'tenant_id is required';
    return;
  end if;

  if p_ordered_categories is null or array_length(p_ordered_categories, 1) is null then
    return query select false, 'Category array is required';
    return;
  end if;

  for v_position in 0..(array_length(p_ordered_categories, 1) - 1) loop
    v_category := p_ordered_categories[v_position + 1];

    if v_category is null then
      continue;
    end if;

    v_new_prefix := array_length(p_ordered_categories, 1) - v_position;

    update personal_prayers
    set display_order = (v_new_prefix * 1000) + (display_order % 1000)
    where user_email = p_user_email
      and tenant_id = p_tenant_id
      and category = v_category;

    v_updated_count := v_updated_count + 1;
  end loop;

  return query select true, format('Successfully reordered %s categories', v_updated_count);
end;
$function$;
