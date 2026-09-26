-- Tenant-scoped church access requests (replaces invite-token flow).
-- Manual verification (run on test DB after apply):
--   set role authenticated; select public.get_tenant_access_state('<tenant_uuid>');
--   select * from account_approval_requests; -- as non-admin should only see own email rows

-- ---------------------------------------------------------------------------
-- 1) account_approval_requests hardening
-- ---------------------------------------------------------------------------
-- Backfill: delete rows that still lack tenant_id (orphans; foundation migration already assigned default-tenant).

delete from public.account_approval_requests where tenant_id is null;

alter table public.account_approval_requests
  drop constraint if exists account_approval_requests_email_key;

drop index if exists public.account_approval_requests_email_key;

alter table public.account_approval_requests
  add constraint account_approval_requests_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade not valid;

alter table public.account_approval_requests validate constraint account_approval_requests_tenant_id_fkey;

alter table public.account_approval_requests
  alter column tenant_id set not null;

create unique index if not exists account_approval_requests_tenant_email_pending_idx
  on public.account_approval_requests (tenant_id, lower(email))
  where approval_status = 'pending';

alter table public.account_approval_requests
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_email text,
  add column if not exists denial_reason text;

drop policy if exists "Allow delete account approval requests" on public.account_approval_requests;
drop policy if exists "Allow read account approval requests" on public.account_approval_requests;
drop policy if exists "Allow update account approval requests" on public.account_approval_requests;
drop policy if exists "Anon users can create account approval request" on public.account_approval_requests;
drop policy if exists "Authenticated users can create account approval request" on public.account_approval_requests;
drop policy if exists "Read account approval requests" on public.account_approval_requests;

revoke all on public.account_approval_requests from anon;

create policy account_approval_requests_select on public.account_approval_requests
  for select to authenticated
  using (
    public.is_tenant_admin(tenant_id)
    or public.is_super_admin()
    or lower(email) = public.current_user_email()
  );

-- Status changes only via approve/deny RPCs (security definer); no direct UPDATE for clients.

create policy account_approval_requests_delete on public.account_approval_requests
  for delete to authenticated
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 2) tenant_memberships.first_login_at
-- ---------------------------------------------------------------------------
alter table public.tenant_memberships
  add column if not exists first_login_at timestamptz;

update public.tenant_memberships
set first_login_at = coalesce(first_login_at, now())
where first_login_at is null;

create or replace function public.tenant_memberships_set_self_first_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.first_login_at is null
     and lower(new.user_email) = public.current_user_email() then
    new.first_login_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists tenant_memberships_self_first_login on public.tenant_memberships;
create trigger tenant_memberships_self_first_login
  before insert on public.tenant_memberships
  for each row
  execute function public.tenant_memberships_set_self_first_login();


-- ---------------------------------------------------------------------------
-- 3) RPCs
-- ---------------------------------------------------------------------------

create or replace function public.get_public_tenant_by_slug(p_slug text)
returns table(id uuid, name text, slug text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.slug
  from public.tenants t
  where t.slug = lower(trim(p_slug))
    and t.plan_tier = 'churches'
    and t.slug <> 'default-tenant'
    and not public.is_reserved_tenant_slug(t.slug);
$$;

grant execute on function public.get_public_tenant_by_slug(text) to anon, authenticated;

create or replace function public.get_tenant_access_state(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  v_plan text;
  v_tenant_name text;
  v_pco boolean := false;
  v_membership public.tenant_memberships%rowtype;
  v_pending boolean := false;
  v_name text;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  select t.plan_tier, t.name into v_plan, v_tenant_name
  from public.tenants t
  where t.id = p_tenant_id;

  if not found then
    return jsonb_build_object('state', 'none');
  end if;

  if public.is_super_admin(v_email) then
    return jsonb_build_object(
      'state', 'member',
      'tenant_name', v_tenant_name,
      'pco_enabled', false
    );
  end if;

  if v_plan is distinct from 'churches' then
    select * into v_membership
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_email = v_email
      and coalesce(tm.is_active, true) = true
      and coalesce(tm.is_blocked, false) = false
    limit 1;

    if found then
      return jsonb_build_object('state', 'member', 'tenant_name', v_tenant_name);
    end if;
    return jsonb_build_object('state', 'none', 'tenant_name', v_tenant_name);
  end if;

  select coalesce(ti.pco_enabled, false) into v_pco
  from public.tenant_integrations ti
  where ti.tenant_id = p_tenant_id;

  select * into v_membership
  from public.tenant_memberships tm
  where tm.tenant_id = p_tenant_id
    and tm.user_email = v_email
  limit 1;

  if found and coalesce(v_membership.is_blocked, false) then
    return jsonb_build_object('state', 'blocked', 'tenant_name', v_tenant_name, 'pco_enabled', v_pco);
  end if;

  select exists (
    select 1 from public.account_approval_requests aar
    where aar.tenant_id = p_tenant_id
      and lower(aar.email) = v_email
      and aar.approval_status = 'pending'
  ) into v_pending;

  if v_pending then
    return jsonb_build_object('state', 'pending', 'tenant_name', v_tenant_name, 'pco_enabled', v_pco);
  end if;

  if found and coalesce(v_membership.is_active, true) = true then
    v_name := nullif(trim(v_membership.name), '');
    if v_membership.first_login_at is not null then
      return jsonb_build_object(
        'state', 'member',
        'name', v_name,
        'tenant_name', v_tenant_name,
        'pco_enabled', v_pco
      );
    end if;
    return jsonb_build_object(
      'state', 'needs_name',
      'name', v_name,
      'tenant_name', v_tenant_name,
      'pco_enabled', v_pco
    );
  end if;

  return jsonb_build_object(
    'state', 'none',
    'tenant_name', v_tenant_name,
    'pco_enabled', v_pco
  );
end;
$$;

grant execute on function public.get_tenant_access_state(uuid) to authenticated;

create or replace function public.complete_tenant_membership_profile(
  p_tenant_id uuid,
  p_first_name text,
  p_last_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  v_name text;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  v_name := trim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, ''));
  if v_name = '' then
    raise exception 'Name is required';
  end if;

  update public.tenant_memberships tm
  set
    name = v_name,
    is_active = true,
    first_login_at = now(),
    updated_at = now()
  where tm.tenant_id = p_tenant_id
    and tm.user_email = v_email
    and coalesce(tm.is_blocked, false) = false;

  if not found then
    raise exception 'Membership not found';
  end if;

  perform public.upsert_user_subscription_free(v_email, v_name);
end;
$$;

grant execute on function public.complete_tenant_membership_profile(uuid, text, text) to authenticated;

drop function if exists public.create_tenant_access_request(uuid, text, text, text);

create or replace function public.create_tenant_access_request(
  p_tenant_id uuid,
  p_first_name text,
  p_last_name text,
  p_affiliation_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  v_id uuid;
  v_plan text;
  v_created boolean := false;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  if trim(coalesce(p_first_name, '')) = '' or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'First and last name are required';
  end if;
  if trim(coalesce(p_affiliation_reason, '')) = '' then
    raise exception 'Affiliation is required';
  end if;

  select plan_tier into v_plan from public.tenants where id = p_tenant_id;
  if v_plan is distinct from 'churches' then
    raise exception 'Access requests are only for church tenants';
  end if;

  if exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_email = v_email
      and coalesce(tm.is_blocked, false) = true
  ) then
    raise exception 'Account blocked';
  end if;

  if exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_email = v_email
      and coalesce(tm.is_active, true) = true
      and coalesce(tm.is_blocked, false) = false
      and tm.first_login_at is not null
  ) then
    raise exception 'Already a member';
  end if;

  update public.account_approval_requests
  set
    first_name = trim(p_first_name),
    last_name = trim(p_last_name),
    affiliation_reason = trim(p_affiliation_reason),
    approval_status = 'pending',
    updated_at = now(),
    reviewed_at = null,
    reviewed_by_email = null,
    denial_reason = null
  where tenant_id = p_tenant_id
    and lower(email) = v_email
    and approval_status = 'pending'
  returning id into v_id;

  if v_id is not null then
    return jsonb_build_object('id', v_id, 'created', false);
  end if;

  insert into public.account_approval_requests (
    email, first_name, last_name, affiliation_reason, approval_status, tenant_id
  )
  values (
    v_email,
    trim(p_first_name),
    trim(p_last_name),
    trim(p_affiliation_reason),
    'pending',
    p_tenant_id
  )
  returning id into v_id;

  v_created := true;
  return jsonb_build_object('id', v_id, 'created', v_created);
end;
$$;

grant execute on function public.create_tenant_access_request(uuid, text, text, text) to authenticated;

revoke update on public.account_approval_requests from authenticated;

create or replace function public.approve_tenant_access_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.account_approval_requests%rowtype;
  v_reviewer text := public.current_user_email();
  v_name text;
begin
  select * into v_req
  from public.account_approval_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if not (public.is_tenant_admin(v_req.tenant_id) or public.is_super_admin()) then
    raise exception 'Forbidden';
  end if;

  if v_req.approval_status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  v_name := trim(v_req.first_name || ' ' || v_req.last_name);

  insert into public.tenant_memberships (
    tenant_id, user_email, role, name, is_active, receive_admin_emails, first_login_at
  )
  values (
    v_req.tenant_id,
    lower(v_req.email),
    'member',
    v_name,
    true,
    false,
    now()
  )
  on conflict (tenant_id, user_email) do update
    set
      name = excluded.name,
      is_active = true,
      is_blocked = false,
      first_login_at = coalesce(public.tenant_memberships.first_login_at, now()),
      role = coalesce(public.tenant_memberships.role, excluded.role);

  perform public.upsert_user_subscription_free(lower(v_req.email), v_name);

  update public.account_approval_requests
  set
    approval_status = 'approved',
    reviewed_at = now(),
    reviewed_by_email = v_reviewer,
    updated_at = now()
  where id = p_request_id;

  select to_jsonb(r) into strict v_req from public.account_approval_requests r where r.id = p_request_id;
  return v_req;
end;
$$;

grant execute on function public.approve_tenant_access_request(uuid) to authenticated;

create or replace function public.deny_tenant_access_request(p_request_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.account_approval_requests%rowtype;
  v_reviewer text := public.current_user_email();
begin
  select * into v_req
  from public.account_approval_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if not (public.is_tenant_admin(v_req.tenant_id) or public.is_super_admin()) then
    raise exception 'Forbidden';
  end if;

  if v_req.approval_status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  update public.account_approval_requests
  set
    approval_status = 'denied',
    reviewed_at = now(),
    reviewed_by_email = v_reviewer,
    denial_reason = nullif(trim(coalesce(p_reason, '')), ''),
    updated_at = now()
  where id = p_request_id;

  select to_jsonb(r) into strict v_req from public.account_approval_requests r where r.id = p_request_id;
  return v_req;
end;
$$;

grant execute on function public.deny_tenant_access_request(uuid, text) to authenticated;

-- PCO join membership write (edge calls after server-side PCO match; not client-callable).
create or replace function public.complete_tenant_pco_join(
  p_tenant_id uuid,
  p_user_email text,
  p_first_name text,
  p_last_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_email text := lower(trim(coalesce(p_user_email, '')));
  v_plan text;
  v_pco boolean := false;
begin
  if v_email = '' then
    raise exception 'Email is required';
  end if;
  v_name := trim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, ''));
  if v_name = '' then
    raise exception 'Name is required';
  end if;

  select t.plan_tier into v_plan from public.tenants t where t.id = p_tenant_id;
  if v_plan is distinct from 'churches' then
    raise exception 'PCO join is only for church tenants';
  end if;

  select coalesce(ti.pco_enabled, false) into v_pco
  from public.tenant_integrations ti
  where ti.tenant_id = p_tenant_id;

  if not v_pco then
    raise exception 'Planning Center is not enabled';
  end if;

  insert into public.tenant_memberships (
    tenant_id, user_email, role, name, is_active, receive_admin_emails,
    in_planning_center, planning_center_checked_at, first_login_at
  )
  values (
    p_tenant_id,
    v_email,
    'member',
    v_name,
    true,
    false,
    true,
    now(),
    now()
  )
  on conflict (tenant_id, user_email) do update
    set
      name = excluded.name,
      is_active = true,
      is_blocked = false,
      in_planning_center = true,
      planning_center_checked_at = now(),
      first_login_at = coalesce(public.tenant_memberships.first_login_at, now());

  perform public.upsert_user_subscription_free(v_email, v_name);
end;
$$;

revoke all on function public.complete_tenant_pco_join(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_tenant_pco_join(uuid, text, text, text) to service_role;

create or replace function public.get_tenant_admin_notification_emails(p_tenant_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select tm.user_email
  from public.tenant_memberships tm
  where tm.tenant_id = p_tenant_id
    and tm.role = 'tenant_admin'
    and coalesce(tm.receive_admin_emails, true) = true
    and coalesce(tm.is_active, true) = true
    and coalesce(tm.is_blocked, false) = false;
$$;

revoke all on function public.get_tenant_admin_notification_emails(uuid) from public, anon, authenticated;
grant execute on function public.get_tenant_admin_notification_emails(uuid) to service_role;

create or replace function public.get_tenant_admin_push_emails(p_tenant_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select tm.user_email
  from public.tenant_memberships tm
  where tm.tenant_id = p_tenant_id
    and tm.role = 'tenant_admin'
    and coalesce(tm.receive_admin_push, false) = true
    and coalesce(tm.is_active, true) = true
    and coalesce(tm.is_blocked, false) = false;
$$;

revoke all on function public.get_tenant_admin_push_emails(uuid) from public, anon, authenticated;
grant execute on function public.get_tenant_admin_push_emails(uuid) to service_role;

drop function if exists public.create_account_approval_request(text, text, text);
drop function if exists public.create_account_approval_request(text, text, text, text);
drop function if exists public.create_account_approval_request(text, text, text, text, uuid);


-- ---------------------------------------------------------------------------
-- 4) is_login_allowed_email (remove global pending-request gate)
-- ---------------------------------------------------------------------------
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
      or exists (
        select 1
        from public.user_subscriptions us
        where us.user_email = lower(trim(p_email))
      )
      or (
        not exists (
          select 1 from public.tenant_memberships tm
          where tm.user_email = lower(trim(p_email))
        )
        and not exists (
          select 1 from public.user_subscriptions us
          where us.user_email = lower(trim(p_email))
        )
        and not public.is_any_prayer_group_member(p_email)
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- 5) Email templates (clone default-tenant first, then fallback HTML; never overwrite)
-- ---------------------------------------------------------------------------
insert into public.email_templates (
  tenant_id, template_key, name, subject, html_body, text_body, description
)
select
  t.id,
  src.template_key,
  src.name,
  src.subject,
  src.html_body,
  src.text_body,
  src.description
from public.tenants t
cross join lateral (
  select et.template_key, et.name, et.subject, et.html_body, et.text_body, et.description
  from public.email_templates et
  where et.tenant_id = (select id from public.tenants where slug = 'default-tenant' limit 1)
    and et.template_key in ('account_approval_request', 'account_approved', 'account_denied')
) src
where not exists (
  select 1 from public.email_templates existing
  where existing.tenant_id = t.id and existing.template_key = src.template_key
);

insert into public.email_templates (
  tenant_id, template_key, name, subject, html_body, text_body, description
)
select
  t.id,
  v.template_key,
  v.name,
  v.subject,
  v.html_body,
  v.text_body,
  v.description
from public.tenants t
cross join (
  values
  (
    'account_approval_request',
    'Account approval request',
    'New Account Access Request: {{firstName}} {{lastName}}',
    '<html><body><p>A new account access request was submitted.</p><p><strong>{{firstName}} {{lastName}}</strong> ({{email}})</p><p>Requested: {{requestedDate}}</p><p>Church affiliation: {{affiliationReason}}</p><p><a href="{{adminLink}}">Review in Admin</a></p><p style="font-size:12px;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p></body></html>',
    'New account access request from {{firstName}} {{lastName}} ({{email}}). Requested: {{requestedDate}}. Church affiliation: {{affiliationReason}}. Admin: {{adminLink}}',
    'Notify tenant admins of a new access request'
  ),
  (
    'account_approved',
    'Account approved',
    'Your account has been approved',
    '<html><body><h1>Account Approved!</h1><p>Hi {{firstName}}, your account request has been approved.</p><p><a href="{{loginLink}}">Log In Now</a></p></body></html>',
    'Hi {{firstName}}, your account has been approved. Log in: {{loginLink}}',
    'Sent when an admin approves an access request'
  ),
  (
    'account_denied',
    'Account denied',
    'Update on your account request',
    '<html><body><h1>Account Request Status</h1><p>Hi {{firstName}},</p><p>After review, we are unable to approve your account request at this time. Please contact us if you have questions: {{supportEmail}}</p></body></html>',
    'Hi {{firstName}}, after review we are unable to approve your account request at this time. Support: {{supportEmail}}',
    'Sent when an admin denies an access request'
  )
) as v(template_key, name, subject, html_body, text_body, description)
where not exists (
  select 1 from public.email_templates et
  where et.tenant_id = t.id and et.template_key = v.template_key
);

