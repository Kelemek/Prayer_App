-- Per-user display order for group filter chips on the Home screen.

alter table public.prayer_group_members
  add column if not exists display_order integer not null default 0;

with ranked as (
  select
    m.id,
    row_number() over (
      partition by lower(m.user_email)
      order by m.created_at asc, m.group_id asc
    ) - 1 as next_order
  from public.prayer_group_members m
  where coalesce(m.is_active, true) = true
)
update public.prayer_group_members m
set display_order = ranked.next_order
from ranked
where m.id = ranked.id;

create index if not exists idx_prayer_group_members_user_display_order
  on public.prayer_group_members (lower(user_email), display_order);

create or replace function public.reorder_prayer_groups(p_ordered_group_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $reorder_groups$
declare
  v_email text := public.current_user_email();
  i integer;
  updated_count integer;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  if p_ordered_group_ids is null then
    raise exception 'p_ordered_group_ids must not be null';
  end if;

  for i in 1 .. coalesce(array_length(p_ordered_group_ids, 1), 0)
  loop
    update public.prayer_group_members
    set display_order = i - 1,
        updated_at = now()
    where group_id = p_ordered_group_ids[i]
      and lower(user_email) = lower(v_email)
      and coalesce(is_active, true) = true;

    get diagnostics updated_count = row_count;
    if updated_count = 0 then
      raise exception 'Unknown or inaccessible group id %', p_ordered_group_ids[i];
    end if;
  end loop;
end;
$reorder_groups$;

comment on function public.reorder_prayer_groups(uuid[]) is
  'Atomically set display_order for the current user''s active group memberships by group id list';

grant execute on function public.reorder_prayer_groups(uuid[])
  to authenticated, service_role;

create or replace function public.create_prayer_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  v_name text := trim(coalesce(p_name, ''));
  v_group_id uuid;
  v_tenant_id uuid;
  v_member_name text;
  v_limits record;
  v_owned integer;
  v_display_order integer;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  if v_name = '' then
    raise exception 'Group name is required';
  end if;

  select * into v_limits from public.effective_group_limits_for_email(v_email);
  v_owned := public.count_owned_prayer_groups(v_email);
  if v_owned >= v_limits.max_groups_owned and not public.is_super_admin(v_email) then
    raise exception 'Group limit reached for your plan';
  end if;

  select tm.tenant_id
    into v_tenant_id
  from public.tenant_memberships tm
  join public.tenants t on t.id = tm.tenant_id
  where tm.user_email = v_email
    and coalesce(tm.is_active, true) = true
    and t.plan_tier = 'churches'
    and t.plan_status in ('active', 'trialing')
  order by t.created_at
  limit 1;

  if v_tenant_id is null then
    v_tenant_id := public.default_tenant_id();
  end if;

  select coalesce(
    (select us.display_name from public.user_subscriptions us
      where us.user_email = v_email and nullif(trim(us.display_name), '') is not null),
    (select tm.name from public.tenant_memberships tm
      where tm.user_email = v_email and nullif(trim(tm.name), '') is not null
      limit 1),
    (select m.name from public.prayer_group_members m
      where m.user_email = v_email and nullif(trim(m.name), '') is not null
      limit 1)
  ) into v_member_name;

  select coalesce(max(m.display_order), -1) + 1
    into v_display_order
  from public.prayer_group_members m
  where lower(m.user_email) = lower(v_email)
    and coalesce(m.is_active, true) = true;

  insert into public.prayer_groups (name, created_by_email, created_from_tenant_id)
  values (v_name, v_email, v_tenant_id)
  returning id into v_group_id;

  insert into public.prayer_group_members (
    group_id, user_email, role, invited_by_email, name, is_active, display_order
  ) values (
    v_group_id, v_email, 'owner', v_email, v_member_name, true, v_display_order
  );

  return v_group_id;
end;
$$;

create or replace function public.invite_prayer_group_member(p_group_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter text := public.current_user_email();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
  v_name text;
  v_owner text;
  v_limits record;
  v_member_count integer;
  v_display_order integer;
  v_existing_active boolean;
begin
  if v_inviter is null or v_inviter = '' then
    raise exception 'Not authenticated';
  end if;
  if v_email = '' then
    raise exception 'Email is required';
  end if;
  if not public.is_prayer_group_member(p_group_id, v_inviter) then
    raise exception 'Only group members can invite others';
  end if;

  v_owner := public.prayer_group_owner_email(p_group_id);
  if v_owner is null then
    raise exception 'Group owner not found';
  end if;

  select * into v_limits from public.effective_group_limits_for_email(v_owner);
  v_member_count := public.count_active_prayer_group_members(p_group_id);

  select coalesce(m.is_active, true)
    into v_existing_active
  from public.prayer_group_members m
  where m.group_id = p_group_id
    and m.user_email = v_email;

  if coalesce(v_existing_active, false) = false
    and v_member_count >= v_limits.max_members_per_group then
    raise exception 'Member limit reached for this group';
  end if;

  select coalesce(
    (select us.display_name from public.user_subscriptions us
      where us.user_email = v_email and nullif(trim(us.display_name), '') is not null),
    (select tm.name from public.tenant_memberships tm
      where tm.user_email = v_email and nullif(trim(tm.name), '') is not null
      limit 1),
    (select m.name from public.prayer_group_members m
      where m.user_email = v_email and nullif(trim(m.name), '') is not null
      limit 1)
  ) into v_name;

  if v_existing_active is null then
    select coalesce(max(m.display_order), -1) + 1
      into v_display_order
    from public.prayer_group_members m
    where lower(m.user_email) = lower(v_email)
      and coalesce(m.is_active, true) = true;
  else
    v_display_order := coalesce(
      (select m.display_order
        from public.prayer_group_members m
        where m.group_id = p_group_id and m.user_email = v_email),
      0
    );
  end if;

  insert into public.prayer_group_members (
    group_id, user_email, role, invited_by_email, name, is_active, display_order
  ) values (
    p_group_id, v_email, 'member', v_inviter, v_name, true, v_display_order
  )
  on conflict (group_id, user_email) do update
    set is_active = true,
        invited_by_email = excluded.invited_by_email,
        name = coalesce(public.prayer_group_members.name, excluded.name),
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;
