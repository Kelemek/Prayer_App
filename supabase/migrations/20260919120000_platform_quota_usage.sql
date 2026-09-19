-- Super-admin read-only platform quota and recite usage snapshot (apply on prayer-test when verifying).

create or replace function public.list_platform_quota_usage_for_super_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month_start timestamptz := date_trunc('month', now());
  v_users jsonb;
  v_tenants jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin only';
  end if;

  with candidate_emails as (
    select distinct lower(trim(pg.created_by_email)) as email
    from public.prayer_groups pg
    where nullif(trim(pg.created_by_email), '') is not null
    union
    select lower(trim(us.user_email))
    from public.user_subscriptions us
    where us.plan_tier = 'pro'
    union
    select distinct lower(trim(u.user_email))
    from public.memorization_recite_usage u
    where u.created_at >= v_month_start
      and nullif(trim(u.user_email), '') is not null
  ),
  user_rows as (
    select
      ce.email,
      public.user_individual_plan_tier(ce.email) as individual_plan_tier,
      public.user_is_church_member(ce.email) as is_church_member,
      public.count_owned_prayer_groups(ce.email) as groups_owned,
      (select l.max_groups_owned from public.effective_group_limits_for_email(ce.email) l) as max_groups_owned,
      (select l.max_members_per_group from public.effective_group_limits_for_email(ce.email) l) as max_members_per_group,
      coalesce(
        (
          select max(public.count_active_prayer_group_members(pg.id))
          from public.prayer_groups pg
          where lower(trim(pg.created_by_email)) = ce.email
        ),
        0
      ) as largest_group_members,
      coalesce(
        (
          select sum(u.estimated_cost_usd) filter (where u.billable)
          from public.memorization_recite_usage u
          where lower(trim(u.user_email)) = ce.email
            and u.created_at >= v_month_start
        ),
        0
      ) as recite_estimated_cost_usd,
      coalesce(
        (
          select sum(u.audio_seconds) filter (where u.billable and u.stt_provider = 'whisper')
          from public.memorization_recite_usage u
          where lower(trim(u.user_email)) = ce.email
            and u.created_at >= v_month_start
        ),
        0
      ) as recite_whisper_audio_seconds
    from candidate_emails ce
    where ce.email is not null and ce.email != ''
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'email', ur.email,
        'individual_plan_tier', ur.individual_plan_tier,
        'is_church_member', ur.is_church_member,
        'groups_owned', ur.groups_owned,
        'max_groups_owned', ur.max_groups_owned,
        'max_members_per_group', ur.max_members_per_group,
        'largest_group_members', ur.largest_group_members,
        'recite_estimated_cost_usd', ur.recite_estimated_cost_usd,
        'recite_whisper_audio_seconds', ur.recite_whisper_audio_seconds
      )
      order by ur.email
    ),
    '[]'::jsonb
  )
  into v_users
  from user_rows ur
  where ur.groups_owned > 0
     or ur.individual_plan_tier = 'pro'
     or ur.is_church_member
     or ur.recite_estimated_cost_usd > 0
     or (
       ur.max_groups_owned > 0
       and ur.groups_owned::numeric / ur.max_groups_owned::numeric >= 0.8
     )
     or (
       ur.max_members_per_group > 0
       and ur.largest_group_members::numeric / ur.max_members_per_group::numeric >= 0.8
     );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'slug', t.slug,
        'plan_tier', t.plan_tier,
        'plan_status', t.plan_status,
        'groups_created_from_tenant', (
          select count(*)::integer
          from public.prayer_groups pg
          where pg.created_from_tenant_id = t.id
        ),
        'recite_attempt_count', coalesce(rs.attempt_count, 0),
        'recite_whisper_attempt_count', coalesce(rs.whisper_attempt_count, 0),
        'recite_billable_audio_seconds', coalesce(rs.billable_audio_seconds, 0),
        'recite_estimated_cost_usd', coalesce(rs.estimated_cost_usd, 0)
      )
      order by t.name
    ),
    '[]'::jsonb
  )
  into v_tenants
  from public.tenants t
  left join lateral (
    select
      count(*)::bigint as attempt_count,
      count(*) filter (where u.stt_provider = 'whisper')::bigint as whisper_attempt_count,
      coalesce(sum(u.audio_seconds) filter (where u.billable), 0) as billable_audio_seconds,
      coalesce(sum(u.estimated_cost_usd) filter (where u.billable), 0) as estimated_cost_usd
    from public.memorization_recite_usage u
    where u.tenant_id = t.id
      and u.created_at >= v_month_start
  ) rs on true
  where t.plan_tier = 'churches';

  return jsonb_build_object('users', v_users, 'tenants', v_tenants);
end;
$$;

grant execute on function public.list_platform_quota_usage_for_super_admin() to authenticated, service_role;
