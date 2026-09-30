-- Absolute app-icon badge for a push recipient.
-- Matches the in-app count: unread Current + Answered prayers, their approved
-- updates, and prompts of active types, summed across the member's churches.
-- The icon is off unless at least one unblocked membership has badges enabled.
-- Service role only: the send-push function calls this; clients must not.

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
  enabled_members as (
    select distinct lower(tm.user_email) as user_email, tm.tenant_id
    from public.tenant_memberships tm
    join input i on i.user_email = lower(tm.user_email)
    where coalesce(tm.is_blocked, false) = false
      and exists (
        select 1
        from public.tenant_memberships flag
        where lower(flag.user_email) = lower(tm.user_email)
          and coalesce(flag.is_blocked, false) = false
          and flag.badge_functionality_enabled
      )
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
  )
  select
    i.user_email,
    case
      when not exists (
        select 1 from enabled_members em where em.user_email = i.user_email
      ) then 0
      else coalesce(pc.n, 0) + coalesce(uc.n, 0) + coalesce(prc.n, 0)
    end as badge_count
  from input i
  left join prayer_counts pc on pc.user_email = i.user_email
  left join update_counts uc on uc.user_email = i.user_email
  left join prompt_counts prc on prc.user_email = i.user_email;
$$;

revoke all on function public.app_icon_badge_counts(text[]) from public;
revoke all on function public.app_icon_badge_counts(text[]) from anon;
revoke all on function public.app_icon_badge_counts(text[]) from authenticated;
grant execute on function public.app_icon_badge_counts(text[]) to service_role;

comment on function public.app_icon_badge_counts(text[]) is
  'Per-email native app icon badge: unread current/answered prayers, updates, and active-type prompts. Zero when badges are disabled.';
