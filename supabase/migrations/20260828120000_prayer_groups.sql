-- Prayer groups: named invite-only prayer lists, independent of tenant membership.

create table if not exists public.prayer_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by_email text not null,
  created_from_tenant_id uuid references public.tenants (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prayer_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.prayer_groups (id) on delete cascade,
  user_email text not null,
  role text not null default 'member'
    check (role in ('owner', 'member')),
  invited_by_email text,
  name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_email)
);

create index if not exists idx_prayer_group_members_email
  on public.prayer_group_members (lower(user_email));

create table if not exists public.group_prayers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.prayer_groups (id) on delete cascade,
  title text not null,
  description text,
  prayer_for text not null default 'General Prayer',
  status text not null default 'current'
    check (status in ('current', 'answered')),
  requester text not null,
  email text not null,
  is_anonymous boolean not null default false,
  date_requested timestamptz not null default now(),
  date_answered timestamptz,
  prayed_for_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_group_prayers_group_id
  on public.group_prayers (group_id, date_requested desc);

create table if not exists public.group_prayer_updates (
  id uuid primary key default gen_random_uuid(),
  group_prayer_id uuid not null references public.group_prayers (id) on delete cascade,
  content text not null,
  author text not null,
  author_email text not null,
  mark_as_answered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_group_prayer_updates_prayer
  on public.group_prayer_updates (group_prayer_id, created_at);

alter table public.prayer_groups enable row level security;
alter table public.prayer_group_members enable row level security;
alter table public.group_prayers enable row level security;
alter table public.group_prayer_updates enable row level security;

-- Helpers

create or replace function public.is_any_prayer_group_member(email_to_check text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.prayer_group_members m
    where m.user_email = lower(trim(coalesce(email_to_check, public.current_user_email())))
      and coalesce(m.is_active, true) = true
  );
$$;

create or replace function public.is_prayer_group_member(p_group_id uuid, email_to_check text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.prayer_group_members m
    where m.group_id = p_group_id
      and m.user_email = lower(trim(coalesce(email_to_check, public.current_user_email())))
      and coalesce(m.is_active, true) = true
  );
$$;

create or replace function public.is_prayer_group_owner(p_group_id uuid, email_to_check text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.prayer_group_members m
    where m.group_id = p_group_id
      and m.user_email = lower(trim(coalesce(email_to_check, public.current_user_email())))
      and m.role = 'owner'
      and coalesce(m.is_active, true) = true
  );
$$;

create or replace function public.can_create_prayer_groups(email_to_check text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.user_email = lower(trim(coalesce(email_to_check, public.current_user_email())))
      and coalesce(tm.is_active, true) = true
      and coalesce(tm.is_blocked, false) = false
      and t.plan_tier in ('groups', 'churches')
      and t.plan_status in ('active', 'trialing')
  )
  or public.is_super_admin(email_to_check);
$$;

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
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  if v_name = '' then
    raise exception 'Group name is required';
  end if;
  if not public.can_create_prayer_groups(v_email) then
    raise exception 'Only members of a groups or churches plan can create groups';
  end if;

  select tm.tenant_id
    into v_tenant_id
  from public.tenant_memberships tm
  join public.tenants t on t.id = tm.tenant_id
  where tm.user_email = v_email
    and coalesce(tm.is_active, true) = true
    and t.plan_tier in ('groups', 'churches')
  order by t.created_at
  limit 1;

  select coalesce(
    (select tm.name from public.tenant_memberships tm
      where tm.user_email = v_email and nullif(trim(tm.name), '') is not null
      limit 1),
    (select m.name from public.prayer_group_members m
      where m.user_email = v_email and nullif(trim(m.name), '') is not null
      limit 1)
  ) into v_member_name;

  insert into public.prayer_groups (name, created_by_email, created_from_tenant_id)
  values (v_name, v_email, v_tenant_id)
  returning id into v_group_id;

  insert into public.prayer_group_members (
    group_id, user_email, role, invited_by_email, name, is_active
  ) values (
    v_group_id, v_email, 'owner', v_email, v_member_name, true
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

  select coalesce(
    (select tm.name from public.tenant_memberships tm
      where tm.user_email = v_email and nullif(trim(tm.name), '') is not null
      limit 1),
    (select m.name from public.prayer_group_members m
      where m.user_email = v_email and nullif(trim(m.name), '') is not null
      limit 1)
  ) into v_name;

  insert into public.prayer_group_members (
    group_id, user_email, role, invited_by_email, name, is_active
  ) values (
    p_group_id, v_email, 'member', v_inviter, v_name, true
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

create or replace function public.set_prayer_group_member_name(p_email text, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := public.current_user_email();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_actor is null or v_actor = '' then
    raise exception 'Not authenticated';
  end if;
  if v_email = '' or v_name = '' then
    raise exception 'Email and name are required';
  end if;
  if v_actor <> v_email and not public.is_super_admin(v_actor) then
    raise exception 'You can only set your own name';
  end if;
  if not public.is_any_prayer_group_member(v_email) then
    raise exception 'Not a group member';
  end if;

  update public.prayer_group_members
  set name = v_name, updated_at = now()
  where user_email = v_email;
end;
$$;

create or replace function public.rename_prayer_group(p_group_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  v_name text := trim(coalesce(p_name, ''));
begin
  if not public.is_prayer_group_owner(p_group_id, v_email) then
    raise exception 'Only the group owner can rename the group';
  end if;
  if v_name = '' then
    raise exception 'Group name is required';
  end if;
  update public.prayer_groups
  set name = v_name, updated_at = now()
  where id = p_group_id;
end;
$$;

create or replace function public.delete_prayer_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
begin
  if not public.is_prayer_group_owner(p_group_id, v_email)
     and not public.is_super_admin(v_email) then
    raise exception 'Only the group owner can delete the group';
  end if;
  delete from public.prayer_groups where id = p_group_id;
end;
$$;

create or replace function public.leave_prayer_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  v_role text;
  v_owners integer;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  select m.role into v_role
  from public.prayer_group_members m
  where m.group_id = p_group_id
    and m.user_email = v_email
    and coalesce(m.is_active, true) = true;

  if v_role is null then
    raise exception 'Not a member of this group';
  end if;

  if v_role = 'owner' then
    select count(*) into v_owners
    from public.prayer_group_members m
    where m.group_id = p_group_id
      and m.role = 'owner'
      and coalesce(m.is_active, true) = true;
    if v_owners <= 1 then
      raise exception 'Transfer ownership or delete the group before leaving';
    end if;
  end if;

  delete from public.prayer_group_members
  where group_id = p_group_id
    and user_email = v_email;
end;
$$;

create or replace function public.remove_prayer_group_member(
  p_group_id uuid,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := public.current_user_email();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text;
  v_owner_count integer;
begin
  if v_actor is null or v_actor = '' then
    raise exception 'Not authenticated';
  end if;
  if v_email = '' then
    raise exception 'Email is required';
  end if;
  if not public.is_prayer_group_owner(p_group_id, v_actor)
     and not public.is_super_admin(v_actor) then
    raise exception 'Only the group owner can remove members';
  end if;

  select m.role
    into v_role
  from public.prayer_group_members m
  where m.group_id = p_group_id
    and m.user_email = v_email
    and coalesce(m.is_active, true) = true;

  if v_role is null then
    raise exception 'Member not found in this group';
  end if;

  if v_role = 'owner' then
    select count(*)::integer
      into v_owner_count
    from public.prayer_group_members m
    where m.group_id = p_group_id
      and m.role = 'owner'
      and coalesce(m.is_active, true) = true;
    if v_owner_count <= 1 then
      raise exception 'Cannot remove the sole group owner';
    end if;
  end if;

  delete from public.prayer_group_members
  where group_id = p_group_id
    and user_email = v_email;
end;
$$;

grant execute on function public.is_any_prayer_group_member(text) to anon, authenticated, service_role;
grant execute on function public.is_prayer_group_member(uuid, text) to anon, authenticated, service_role;
grant execute on function public.is_prayer_group_owner(uuid, text) to anon, authenticated, service_role;
grant execute on function public.can_create_prayer_groups(text) to anon, authenticated, service_role;
grant execute on function public.create_prayer_group(text) to authenticated;
grant execute on function public.invite_prayer_group_member(uuid, text) to authenticated;
grant execute on function public.set_prayer_group_member_name(text, text) to authenticated;
grant execute on function public.rename_prayer_group(uuid, text) to authenticated;
grant execute on function public.delete_prayer_group(uuid) to authenticated;
grant execute on function public.leave_prayer_group(uuid) to authenticated;
grant execute on function public.remove_prayer_group_member(uuid, text) to authenticated;

-- Login gate: group members may receive OTP without tenant membership.
create or replace function public.is_login_allowed_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    nullif(lower(trim(coalesce(p_email, ''))), '') is not null
    and (
      exists (
        select 1
        from public.global_roles gr
        where gr.user_email = lower(trim(p_email))
          and gr.role = 'super_admin'
      )
      or exists (
        select 1
        from public.tenant_memberships tm
        where tm.user_email = lower(trim(p_email))
          and coalesce(tm.is_active, true) = true
          and coalesce(tm.is_blocked, false) = false
      )
      or public.is_any_prayer_group_member(p_email)
    )
    and (
      public.is_any_prayer_group_member(p_email)
      or not exists (
        select 1
        from public.account_approval_requests aar
        where lower(aar.email) = lower(trim(p_email))
          and aar.approval_status = 'pending'
      )
    );
$$;

-- RLS

drop policy if exists prayer_groups_select_member on public.prayer_groups;
create policy prayer_groups_select_member on public.prayer_groups
  for select to authenticated
  using (public.is_prayer_group_member(id) or public.is_super_admin());

drop policy if exists prayer_groups_update_owner on public.prayer_groups;
create policy prayer_groups_update_owner on public.prayer_groups
  for update to authenticated
  using (public.is_prayer_group_owner(id) or public.is_super_admin())
  with check (public.is_prayer_group_owner(id) or public.is_super_admin());

drop policy if exists prayer_groups_delete_owner on public.prayer_groups;
create policy prayer_groups_delete_owner on public.prayer_groups
  for delete to authenticated
  using (public.is_prayer_group_owner(id) or public.is_super_admin());

drop policy if exists prayer_group_members_select on public.prayer_group_members;
create policy prayer_group_members_select on public.prayer_group_members
  for select to authenticated
  using (public.is_prayer_group_member(group_id) or public.is_super_admin());

drop policy if exists prayer_group_members_update_own on public.prayer_group_members;
create policy prayer_group_members_update_own on public.prayer_group_members
  for update to authenticated
  using (
    lower(user_email) = public.current_user_email()
    or public.is_prayer_group_owner(group_id)
    or public.is_super_admin()
  )
  with check (
    lower(user_email) = public.current_user_email()
    or public.is_prayer_group_owner(group_id)
    or public.is_super_admin()
  );

drop policy if exists prayer_group_members_delete_own on public.prayer_group_members;
create policy prayer_group_members_delete_own on public.prayer_group_members
  for delete to authenticated
  using (
    lower(user_email) = public.current_user_email()
    or public.is_prayer_group_owner(group_id)
    or public.is_super_admin()
  );

drop policy if exists group_prayers_member_all on public.group_prayers;
drop policy if exists group_prayers_select_member on public.group_prayers;
create policy group_prayers_select_member on public.group_prayers
  for select to authenticated
  using (public.is_prayer_group_member(group_id) or public.is_super_admin());

drop policy if exists group_prayers_insert_member on public.group_prayers;
create policy group_prayers_insert_member on public.group_prayers
  for insert to authenticated
  with check (public.is_prayer_group_member(group_id) or public.is_super_admin());

drop policy if exists group_prayers_update_member on public.group_prayers;
create policy group_prayers_update_member on public.group_prayers
  for update to authenticated
  using (public.is_prayer_group_member(group_id) or public.is_super_admin())
  with check (public.is_prayer_group_member(group_id) or public.is_super_admin());

drop policy if exists group_prayers_delete_member on public.group_prayers;
create policy group_prayers_delete_member on public.group_prayers
  for delete to authenticated
  using (public.is_prayer_group_member(group_id) or public.is_super_admin());

drop policy if exists group_prayer_updates_select_member on public.group_prayer_updates;
create policy group_prayer_updates_select_member on public.group_prayer_updates
  for select to authenticated
  using (
    exists (
      select 1 from public.group_prayers gp
      where gp.id = group_prayer_id
        and (public.is_prayer_group_member(gp.group_id) or public.is_super_admin())
    )
  );

drop policy if exists group_prayer_updates_insert_member on public.group_prayer_updates;
create policy group_prayer_updates_insert_member on public.group_prayer_updates
  for insert to authenticated
  with check (
    exists (
      select 1 from public.group_prayers gp
      where gp.id = group_prayer_id
        and (public.is_prayer_group_member(gp.group_id) or public.is_super_admin())
    )
  );

drop policy if exists group_prayer_updates_update_member on public.group_prayer_updates;
create policy group_prayer_updates_update_member on public.group_prayer_updates
  for update to authenticated
  using (
    exists (
      select 1 from public.group_prayers gp
      where gp.id = group_prayer_id
        and (public.is_prayer_group_member(gp.group_id) or public.is_super_admin())
    )
  )
  with check (
    exists (
      select 1 from public.group_prayers gp
      where gp.id = group_prayer_id
        and (public.is_prayer_group_member(gp.group_id) or public.is_super_admin())
    )
  );

drop policy if exists group_prayer_updates_delete_member on public.group_prayer_updates;
create policy group_prayer_updates_delete_member on public.group_prayer_updates
  for delete to authenticated
  using (
    exists (
      select 1 from public.group_prayers gp
      where gp.id = group_prayer_id
        and (public.is_prayer_group_member(gp.group_id) or public.is_super_admin())
    )
  );

-- Unaffiliated personal / memorize rows (group-only users)

alter table public.personal_prayers
  alter column tenant_id drop not null;

alter table public.memorized_items
  alter column tenant_id drop not null;

drop index if exists public.memorized_items_verse_unique;
create unique index if not exists memorized_items_verse_unique
  on public.memorized_items (lower(user_email), tenant_id, reference, translation)
  where kind = 'verse' and tenant_id is not null;

create unique index if not exists memorized_items_verse_unaffiliated_unique
  on public.memorized_items (lower(user_email), reference, translation)
  where kind = 'verse' and tenant_id is null;

drop index if exists public.memorized_items_bible_books_unique;
create unique index if not exists memorized_items_bible_books_unique
  on public.memorized_items (lower(user_email), tenant_id, bible_books_scope)
  where kind = 'bibleBooks' and tenant_id is not null;

create unique index if not exists memorized_items_bible_books_unaffiliated_unique
  on public.memorized_items (lower(user_email), bible_books_scope)
  where kind = 'bibleBooks' and tenant_id is null;

drop policy if exists memorized_items_select_own on public.memorized_items;
create policy memorized_items_select_own on public.memorized_items
  for select to authenticated
  using (
    (
      lower(user_email) = public.current_user_email()
      and (
        (tenant_id is not null and public.is_tenant_member(tenant_id))
        or (tenant_id is null and public.is_any_prayer_group_member())
      )
    )
    or public.is_super_admin()
  );

drop policy if exists memorized_items_insert_own on public.memorized_items;
create policy memorized_items_insert_own on public.memorized_items
  for insert to authenticated
  with check (
    (
      lower(user_email) = public.current_user_email()
      and (
        (tenant_id is not null and public.is_tenant_member(tenant_id))
        or (tenant_id is null and public.is_any_prayer_group_member())
      )
    )
    or public.is_super_admin()
  );

drop policy if exists memorized_items_update_own on public.memorized_items;
create policy memorized_items_update_own on public.memorized_items
  for update to authenticated
  using (
    (
      lower(user_email) = public.current_user_email()
      and (
        (tenant_id is not null and public.is_tenant_member(tenant_id))
        or (tenant_id is null and public.is_any_prayer_group_member())
      )
    )
    or public.is_super_admin()
  )
  with check (
    (
      lower(user_email) = public.current_user_email()
      and (
        (tenant_id is not null and public.is_tenant_member(tenant_id))
        or (tenant_id is null and public.is_any_prayer_group_member())
      )
    )
    or public.is_super_admin()
  );

drop policy if exists memorized_items_delete_own on public.memorized_items;
create policy memorized_items_delete_own on public.memorized_items
  for delete to authenticated
  using (
    (
      lower(user_email) = public.current_user_email()
      and (
        (tenant_id is not null and public.is_tenant_member(tenant_id))
        or (tenant_id is null and public.is_any_prayer_group_member())
      )
    )
    or public.is_super_admin()
  );

-- Attach unaffiliated personal/memorize rows when the user first joins a tenant.
create or replace function public.attach_unaffiliated_user_data_to_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.personal_prayers
  set tenant_id = new.tenant_id
  where lower(user_email) = lower(new.user_email)
    and tenant_id is null;

  update public.memorized_items
  set tenant_id = new.tenant_id
  where lower(user_email) = lower(new.user_email)
    and tenant_id is null;

  return new;
end;
$$;

drop trigger if exists tenant_memberships_attach_unaffiliated on public.tenant_memberships;
create trigger tenant_memberships_attach_unaffiliated
  after insert on public.tenant_memberships
  for each row
  execute function public.attach_unaffiliated_user_data_to_tenant();

-- Group invitation email template (cloned to new orgs via seed_tenant_email_defaults).
insert into public.email_templates (
  tenant_id,
  template_key,
  name,
  subject,
  html_body,
  text_body,
  description
)
select
  t.id,
  'group_invitation',
  'Prayer group invitation',
  'You''ve been invited to {{groupName}}',
  $html$<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;">
          <tr>
            <td bgcolor="#39704D" style="background-color:#39704D;padding:20px;border-radius:8px 8px 0 0;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;">You''re invited to a prayer group</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;">
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">{{inviterName}} invited you to join <strong>{{groupName}}</strong>.</p>
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">Log in with this email to see group prayers, keep a personal prayer list, and memorize Scripture. You will not see the church''s public prayer list unless you are also invited to that organization.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto 0;">
                <tr>
                  <td bgcolor="#39704D" style="background-color:#39704D;border-radius:6px;">
                    <a href="{{appLink}}" style="display:inline-block;padding:12px 24px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">Open the app</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$html$,
  'You have been invited to {{groupName}} by {{inviterName}}. Log in at {{appLink}} with this email to join the group.',
  'Sent when someone is invited to a prayer group.'
from public.tenants t
where not exists (
  select 1
  from public.email_templates existing
  where existing.tenant_id = t.id
    and existing.template_key = 'group_invitation'
);

-- Group prayer notification templates: copies of approved_prayer / approved_update per tenant.
insert into public.email_templates (
  tenant_id,
  template_key,
  name,
  subject,
  html_body,
  text_body,
  description
)
select
  src.tenant_id,
  'group_prayer_added',
  'Group prayer added',
  src.subject,
  src.html_body,
  src.text_body,
  'Sent when a prayer is added to a prayer group the recipient belongs to.'
from public.email_templates src
where src.template_key = 'approved_prayer'
  and not exists (
    select 1
    from public.email_templates existing
    where existing.tenant_id = src.tenant_id
      and existing.template_key = 'group_prayer_added'
  );

insert into public.email_templates (
  tenant_id,
  template_key,
  name,
  subject,
  html_body,
  text_body,
  description
)
select
  src.tenant_id,
  'group_prayer_update',
  'Group prayer update',
  src.subject,
  src.html_body,
  src.text_body,
  'Sent when an update is posted on a group prayer the recipient belongs to.'
from public.email_templates src
where src.template_key = 'approved_update'
  and not exists (
    select 1
    from public.email_templates existing
    where existing.tenant_id = src.tenant_id
      and existing.template_key = 'group_prayer_update'
  );
