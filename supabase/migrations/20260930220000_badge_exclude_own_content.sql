-- Do not badge the member for prayers or updates they authored.

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
      and lower(p.email) <> em.user_email
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
      and lower(u.author_email) <> em.user_email
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
      and lower(gp.email) <> gm.user_email
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
      and lower(u.author_email) <> gm.user_email
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
  'Per-email native app icon badge: church + prompts + group unread counts, excluding own prayers/updates. Zero when badges are disabled.';
