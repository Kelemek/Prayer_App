-- Group prayer badge read receipts (not tenant-scoped).
-- Backfill marks existing group prayers/updates read so only new activity badges.

create table if not exists public.group_badge_read_receipts (
  user_email text not null,
  group_id uuid not null references public.prayer_groups (id) on delete cascade,
  item_kind text not null
    check (item_kind in ('group_prayer', 'group_prayer_update')),
  item_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (user_email, item_kind, item_id)
);

create index if not exists idx_group_badge_read_receipts_email
  on public.group_badge_read_receipts (user_email);

create index if not exists idx_group_badge_read_receipts_group_email
  on public.group_badge_read_receipts (group_id, user_email, item_kind);

comment on table public.group_badge_read_receipts is
  'Per-user read receipts for group prayer notification badges.';

alter table public.group_badge_read_receipts enable row level security;

revoke all on table public.group_badge_read_receipts from anon;
grant select, insert, delete on table public.group_badge_read_receipts to authenticated;

drop policy if exists group_badge_read_receipts_select_own on public.group_badge_read_receipts;
create policy group_badge_read_receipts_select_own
  on public.group_badge_read_receipts
  for select
  to authenticated
  using (
    lower(user_email) = public.current_user_email()
    and public.is_prayer_group_member(group_id)
  );

drop policy if exists group_badge_read_receipts_insert_own on public.group_badge_read_receipts;
create policy group_badge_read_receipts_insert_own
  on public.group_badge_read_receipts
  for insert
  to authenticated
  with check (
    lower(user_email) = public.current_user_email()
    and public.is_prayer_group_member(group_id)
  );

drop policy if exists group_badge_read_receipts_delete_own on public.group_badge_read_receipts;
create policy group_badge_read_receipts_delete_own
  on public.group_badge_read_receipts
  for delete
  to authenticated
  using (
    lower(user_email) = public.current_user_email()
    and public.is_prayer_group_member(group_id)
  );

create or replace function public.get_group_badge_read_receipts()
returns table (item_kind text, item_id uuid, group_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
begin
  caller_email := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));
  if caller_email is null then
    return;
  end if;

  return query
  select r.item_kind, r.item_id, r.group_id
  from public.group_badge_read_receipts r
  where r.user_email = caller_email
    and public.is_prayer_group_member(r.group_id, caller_email);
end;
$$;

create or replace function public.upsert_group_badge_read_receipts(
  p_group_ids uuid[],
  p_item_kinds text[],
  p_item_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
  inserted_count integer := 0;
begin
  caller_email := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));
  if caller_email is null then
    return 0;
  end if;

  if p_group_ids is null or p_item_kinds is null or p_item_ids is null
     or cardinality(p_group_ids) = 0
     or cardinality(p_group_ids) <> cardinality(p_item_kinds)
     or cardinality(p_group_ids) <> cardinality(p_item_ids) then
    return 0;
  end if;

  insert into public.group_badge_read_receipts (user_email, group_id, item_kind, item_id)
  select
    caller_email,
    gid,
    kind,
    iid
  from unnest(p_group_ids, p_item_kinds, p_item_ids) as t(gid, kind, iid)
  where kind in ('group_prayer', 'group_prayer_update')
    and public.is_prayer_group_member(gid, caller_email)
    and (
      (kind = 'group_prayer' and exists (
        select 1 from public.group_prayers gp
        where gp.id = iid and gp.group_id = gid
      ))
      or (kind = 'group_prayer_update' and exists (
        select 1
        from public.group_prayer_updates u
        join public.group_prayers gp on gp.id = u.group_prayer_id
        where u.id = iid and gp.group_id = gid
      ))
    )
  on conflict (user_email, item_kind, item_id) do nothing;

  get diagnostics inserted_count = row_count;
  return coalesce(inserted_count, 0);
end;
$$;

revoke all on function public.get_group_badge_read_receipts() from public;
revoke all on function public.get_group_badge_read_receipts() from anon;
grant execute on function public.get_group_badge_read_receipts()
  to authenticated, service_role;

revoke all on function public.upsert_group_badge_read_receipts(uuid[], text[], uuid[]) from public;
revoke all on function public.upsert_group_badge_read_receipts(uuid[], text[], uuid[]) from anon;
grant execute on function public.upsert_group_badge_read_receipts(uuid[], text[], uuid[])
  to authenticated, service_role;

-- Existing group content is treated as already seen (same as enabling church badges).
insert into public.group_badge_read_receipts (user_email, group_id, item_kind, item_id)
select distinct
  lower(m.user_email),
  gp.group_id,
  'group_prayer',
  gp.id
from public.prayer_group_members m
join public.group_prayers gp on gp.group_id = m.group_id
where coalesce(m.is_active, true)
on conflict (user_email, item_kind, item_id) do nothing;

insert into public.group_badge_read_receipts (user_email, group_id, item_kind, item_id)
select distinct
  lower(m.user_email),
  gp.group_id,
  'group_prayer_update',
  u.id
from public.prayer_group_members m
join public.group_prayers gp on gp.group_id = m.group_id
join public.group_prayer_updates u on u.group_prayer_id = gp.id
where coalesce(m.is_active, true)
on conflict (user_email, item_kind, item_id) do nothing;

-- Extend push icon badge with group unread counts.
create or replace function public.app_icon_badge_counts(p_emails text[])
returns table (user_email text, badge_count integer)
language sql
stable
security definer
set search_path = public
as $$
  with input as (
    select distinct lower(trim(email)) as user_email
    from unnest(coalesce(p_emails, array[]::text[])) as email
    where nullif(trim(email), '') is not null
  ),
  badges_enabled as (
    select distinct lower(tm.user_email) as user_email
    from public.tenant_memberships tm
    join input i on i.user_email = lower(tm.user_email)
    where coalesce(tm.is_blocked, false) = false
      and tm.badge_functionality_enabled
  ),
  enabled_members as (
    select distinct lower(tm.user_email) as user_email, tm.tenant_id
    from public.tenant_memberships tm
    join badges_enabled b on b.user_email = lower(tm.user_email)
    where coalesce(tm.is_blocked, false) = false
  ),
  group_members as (
    select distinct lower(m.user_email) as user_email, m.group_id
    from public.prayer_group_members m
    join badges_enabled b on b.user_email = lower(m.user_email)
    where coalesce(m.is_active, true)
  ),
  prayer_counts as (
    select em.user_email, count(*)::integer as n
    from enabled_members em
    join public.prayers p on p.tenant_id = em.tenant_id
    where p.approval_status = 'approved'
      and p.status in ('current', 'answered')
      and not exists (
        select 1
        from public.badge_read_receipts r
        where r.tenant_id = p.tenant_id
          and r.user_email = em.user_email
          and r.item_kind = 'prayer'
          and r.item_id = p.id
      )
    group by em.user_email
  ),
  update_counts as (
    select em.user_email, count(*)::integer as n
    from enabled_members em
    join public.prayers p on p.tenant_id = em.tenant_id
    join public.prayer_updates u
      on u.prayer_id = p.id
     and u.tenant_id = p.tenant_id
    where p.approval_status = 'approved'
      and p.status in ('current', 'answered')
      and u.approval_status = 'approved'
      and not exists (
        select 1
        from public.badge_read_receipts r
        where r.tenant_id = p.tenant_id
          and r.user_email = em.user_email
          and r.item_kind = 'prayer_update'
          and r.item_id = u.id
      )
    group by em.user_email
  ),
  prompt_counts as (
    select em.user_email, count(*)::integer as n
    from enabled_members em
    join public.prayer_prompts pr on pr.tenant_id = em.tenant_id
    where exists (
        select 1
        from public.prayer_types pt
        where pt.tenant_id = pr.tenant_id
          and pt.name = pr.type
          and pt.is_active
      )
      and not exists (
        select 1
        from public.badge_read_receipts r
        where r.tenant_id = pr.tenant_id
          and r.user_email = em.user_email
          and r.item_kind = 'prompt'
          and r.item_id = pr.id
      )
    group by em.user_email
  ),
  group_prayer_counts as (
    select gm.user_email, count(*)::integer as n
    from group_members gm
    join public.group_prayers gp on gp.group_id = gm.group_id
    where gp.status in ('current', 'answered')
      and not exists (
        select 1
        from public.group_badge_read_receipts r
        where r.user_email = gm.user_email
          and r.item_kind = 'group_prayer'
          and r.item_id = gp.id
      )
    group by gm.user_email
  ),
  group_update_counts as (
    select gm.user_email, count(*)::integer as n
    from group_members gm
    join public.group_prayers gp on gp.group_id = gm.group_id
    join public.group_prayer_updates u on u.group_prayer_id = gp.id
    where gp.status in ('current', 'answered')
      and not exists (
        select 1
        from public.group_badge_read_receipts r
        where r.user_email = gm.user_email
          and r.item_kind = 'group_prayer_update'
          and r.item_id = u.id
      )
    group by gm.user_email
  )
  select
    i.user_email,
    case
      when not exists (
        select 1 from badges_enabled b where b.user_email = i.user_email
      ) then 0
      else
        coalesce(pc.n, 0)
        + coalesce(uc.n, 0)
        + coalesce(prc.n, 0)
        + coalesce(gpc.n, 0)
        + coalesce(guc.n, 0)
    end as badge_count
  from input i
  left join prayer_counts pc on pc.user_email = i.user_email
  left join update_counts uc on uc.user_email = i.user_email
  left join prompt_counts prc on prc.user_email = i.user_email
  left join group_prayer_counts gpc on gpc.user_email = i.user_email
  left join group_update_counts guc on guc.user_email = i.user_email;
$$;

comment on function public.app_icon_badge_counts(text[]) is
  'Per-email native app icon badge: church + prompts + group unread counts. Zero when badges are disabled.';
