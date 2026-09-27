-- RLS full sweep (prayer-paid audit, 2026-09-26).
--
-- Root causes found on prayer-paid (vjvanphgxtaoxgtxbngf):
--   1. Legacy permissive policies (USING/WITH CHECK true, auth.uid() IS NOT NULL) on queue/request
--      tables, OR-combined with nothing narrower.
--   2. Tenant-less tables (member_prayer_updates, member_prayed_for_counts) readable/writable by
--      every signed-in user of every church.
--   3. public.current_user_email() returns '' for anon, and several policies compare it with
--      coalesce(x, ''), so anon matches rows whose email is NULL (e.g. tenants.created_by_email).
--   4. SECURITY DEFINER RPCs executable by anon that either have no auth check
--      (apply_tenant_stripe_billing, reminder "due now" feeds) or trust a caller-supplied
--      p_email / p_actor_email instead of the JWT.
--
-- Signed-in app traffic uses Supabase Auth email OTP (user JWT, role authenticated). Edge
-- Functions use the service role, which bypasses RLS and keeps EXECUTE on every function.
-- Leave "Admins can see all personal prayers" / "... prayer updates" unchanged.
--
-- Idempotent: drop policy if exists -> create; create or replace; guarded DO blocks.
-- Do not apply until Mark asks. Apply to prayer-paid only; never prayer-prod.

-- ---------------------------------------------------------------------------
-- 1. Grant hygiene: no anon table access except intentional public reference data;
--    no TRUNCATE for signed-in users (TRUNCATE ignores RLS).
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;

-- Intentionally public: static IBCD memory-verse catalog (no tenant or user data).
grant select on table public.ibcd_memorization_catalog_categories to anon;
grant select on table public.ibcd_memorization_catalog_verses to anon;

revoke truncate on all tables in schema public from authenticated;

-- ---------------------------------------------------------------------------
-- 2. member_prayer_updates / member_prayed_for_counts: tenant-scope Planning Center cards
--    (was: any signed-in user of any church could CRUD every row; 20260926120000).
-- ---------------------------------------------------------------------------

alter table public.member_prayer_updates
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists author_email text default public.current_user_email();

create index if not exists idx_member_prayer_updates_tenant_person
  on public.member_prayer_updates (tenant_id, person_id);

drop policy if exists "Allow all select on member_prayer_updates" on public.member_prayer_updates;
drop policy if exists "Allow all insert on member_prayer_updates" on public.member_prayer_updates;
drop policy if exists "Allow all update on member_prayer_updates" on public.member_prayer_updates;
drop policy if exists "Allow all delete on member_prayer_updates" on public.member_prayer_updates;
drop policy if exists member_prayer_updates_select_authenticated on public.member_prayer_updates;
drop policy if exists member_prayer_updates_insert_authenticated on public.member_prayer_updates;
drop policy if exists member_prayer_updates_update_authenticated on public.member_prayer_updates;
drop policy if exists member_prayer_updates_delete_authenticated on public.member_prayer_updates;

drop policy if exists member_prayer_updates_select_member on public.member_prayer_updates;
create policy member_prayer_updates_select_member
  on public.member_prayer_updates
  for select
  to authenticated
  using (tenant_id is not null and public.is_tenant_member(tenant_id));

drop policy if exists member_prayer_updates_insert_member on public.member_prayer_updates;
create policy member_prayer_updates_insert_member
  on public.member_prayer_updates
  for insert
  to authenticated
  with check (
    public.current_user_email() <> ''
    and tenant_id is not null
    and public.is_tenant_member(tenant_id)
    and lower(coalesce(author_email, '')) = public.current_user_email()
  );

drop policy if exists member_prayer_updates_update_author_or_admin on public.member_prayer_updates;
create policy member_prayer_updates_update_author_or_admin
  on public.member_prayer_updates
  for update
  to authenticated
  using (
    tenant_id is not null
    and (
      public.is_tenant_admin(tenant_id)
      or (
        public.current_user_email() <> ''
        and public.is_tenant_member(tenant_id)
        and lower(coalesce(author_email, '')) = public.current_user_email()
      )
    )
  )
  with check (
    tenant_id is not null
    and (
      public.is_tenant_admin(tenant_id)
      or (
        public.current_user_email() <> ''
        and public.is_tenant_member(tenant_id)
        and lower(coalesce(author_email, '')) = public.current_user_email()
      )
    )
  );

drop policy if exists member_prayer_updates_delete_author_or_admin on public.member_prayer_updates;
create policy member_prayer_updates_delete_author_or_admin
  on public.member_prayer_updates
  for delete
  to authenticated
  using (
    tenant_id is not null
    and (
      public.is_tenant_admin(tenant_id)
      or (
        public.current_user_email() <> ''
        and public.is_tenant_member(tenant_id)
        and lower(coalesce(author_email, '')) = public.current_user_email()
      )
    )
  );

revoke all on table public.member_prayer_updates from public, anon;
grant select, insert, update, delete on table public.member_prayer_updates to authenticated;
revoke truncate on table public.member_prayer_updates from authenticated;

-- Counts: key by (tenant_id, person_id). PCO person ids are per PCO org, so one global
-- counter leaked and mixed counts across churches. Legacy rows without a tenant cannot be
-- attributed and are removed (prayer-paid had 0 rows on 2026-09-26).
alter table public.member_prayed_for_counts
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

do $$
begin
  if exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.member_prayed_for_counts'::regclass
      and c.contype = 'p'
      and pg_get_constraintdef(c.oid) = 'PRIMARY KEY (person_id)'
  ) then
    delete from public.member_prayed_for_counts where tenant_id is null;
    alter table public.member_prayed_for_counts alter column tenant_id set not null;
    alter table public.member_prayed_for_counts drop constraint member_prayed_for_counts_pkey;
    alter table public.member_prayed_for_counts
      add constraint member_prayed_for_counts_pkey primary key (tenant_id, person_id);
  end if;
end $$;

drop policy if exists "Allow select on member_prayed_for_counts" on public.member_prayed_for_counts;
drop policy if exists member_prayed_for_counts_select_authenticated on public.member_prayed_for_counts;
drop policy if exists member_prayed_for_counts_select_member on public.member_prayed_for_counts;
create policy member_prayed_for_counts_select_member
  on public.member_prayed_for_counts
  for select
  to authenticated
  using (public.is_tenant_member(tenant_id));

revoke all on table public.member_prayed_for_counts from public, anon;
revoke insert, update, delete, truncate on table public.member_prayed_for_counts from authenticated;
grant select on table public.member_prayed_for_counts to authenticated;

-- Old unscoped RPC wrote rows with no tenant; replace with a tenant-checked overload.
drop function if exists public.increment_member_prayed_for_count(text);

create or replace function public.increment_member_prayed_for_count(
  p_tenant_id uuid,
  p_person_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
  trimmed_id text := nullif(trim(coalesce(p_person_id, '')), '');
begin
  if p_tenant_id is null or trimmed_id is null then
    return null;
  end if;

  if public.current_user_email() = '' or not public.is_tenant_member(p_tenant_id) then
    raise exception 'Not authorized for tenant';
  end if;

  insert into public.member_prayed_for_counts (tenant_id, person_id, prayed_for_count, updated_at)
  values (p_tenant_id, trimmed_id, 1, now())
  on conflict (tenant_id, person_id) do update
    set prayed_for_count = public.member_prayed_for_counts.prayed_for_count + 1,
        updated_at = now()
  returning prayed_for_count into new_count;

  return coalesce(new_count, 0);
end;
$$;

revoke all on function public.increment_member_prayed_for_count(uuid, text) from public, anon;
grant execute on function public.increment_member_prayed_for_count(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. deletion_requests: was anon-readable (requested_email, reason), anon-insertable, and
--    updatable/deletable by any signed-in user; "Admins can manage" used is_admin(), which is
--    true for a tenant admin of ANY church. Mirror update_deletion_requests (20260926120000).
-- ---------------------------------------------------------------------------

drop policy if exists "Anyone can view deletion requests" on public.deletion_requests;
drop policy if exists "Anyone can submit deletion requests" on public.deletion_requests;
drop policy if exists "Only authenticated users can update deletion requests" on public.deletion_requests;
drop policy if exists "Only authenticated users can delete deletion requests" on public.deletion_requests;
drop policy if exists "Admins can manage deletion_requests" on public.deletion_requests;

drop policy if exists deletion_requests_select_own_or_admin on public.deletion_requests;
create policy deletion_requests_select_own_or_admin
  on public.deletion_requests
  for select
  to authenticated
  using (
    public.current_user_email() <> ''
    and (
      public.is_tenant_admin(tenant_id)
      or lower(trim(coalesce(requested_email, ''))) = public.current_user_email()
    )
  );

drop policy if exists deletion_requests_insert_own on public.deletion_requests;
create policy deletion_requests_insert_own
  on public.deletion_requests
  for insert
  to authenticated
  with check (
    public.current_user_email() <> ''
    and lower(trim(coalesce(requested_email, ''))) = public.current_user_email()
    and public.is_tenant_member(tenant_id)
    and exists (
      select 1
      from public.prayers p
      where p.id = deletion_requests.prayer_id
        and p.tenant_id = deletion_requests.tenant_id
    )
  );

drop policy if exists deletion_requests_update_admin on public.deletion_requests;
create policy deletion_requests_update_admin
  on public.deletion_requests
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

revoke all on table public.deletion_requests from public, anon;
grant select, insert, update on table public.deletion_requests to authenticated;
revoke delete, truncate on table public.deletion_requests from authenticated;

-- ---------------------------------------------------------------------------
-- 4. email_queue: was "Anyone can enqueue emails" (anon, any recipient, any template, any
--    variables -> sent from the church's mail identity by trigger-email-processor).
--    Tenant admins may enqueue for their tenant; members may enqueue only the group
--    notification templates, only to active members of the same tenant (mirrors send-email).
--    The processor uses the service role and is unaffected.
-- ---------------------------------------------------------------------------

drop policy if exists "Anyone can enqueue emails" on public.email_queue;
drop policy if exists "Service role can process queue" on public.email_queue;

drop policy if exists email_queue_insert_tenant_admin on public.email_queue;
create policy email_queue_insert_tenant_admin
  on public.email_queue
  for insert
  to authenticated
  with check (
    tenant_id is not null
    and public.is_tenant_admin(tenant_id)
    and status = 'pending'
    and attempts = 0
  );

drop policy if exists email_queue_insert_member_group_notice on public.email_queue;
create policy email_queue_insert_member_group_notice
  on public.email_queue
  for insert
  to authenticated
  with check (
    public.current_user_email() <> ''
    and tenant_id is not null
    and public.is_tenant_member(tenant_id)
    and template_key in ('group_prayer_added', 'group_prayer_update', 'prayer_answered')
    and public.is_tenant_member(tenant_id, lower(trim(recipient)))
    and status = 'pending'
    and attempts = 0
  );

revoke all on table public.email_queue from public, anon;
revoke select, update, delete, truncate on table public.email_queue from authenticated;
grant insert on table public.email_queue to authenticated;

-- ---------------------------------------------------------------------------
-- 5. tenants / tenant_memberships: close the '' identity hole.
--    current_user_email() is '' for anon, so coalesce(lower(created_by_email), '') = ''
--    let anon read default-tenant (created_by_email is NULL), insert tenants with a NULL
--    creator, and bootstrap a tenant_admin membership with user_email ''.
-- ---------------------------------------------------------------------------

drop policy if exists tenant_read_tenants on public.tenants;
create policy tenant_read_tenants
  on public.tenants
  for select
  to authenticated
  using (
    public.is_tenant_member(id)
    or public.is_super_admin()
    or (
      public.current_user_email() <> ''
      and lower(coalesce(created_by_email, '')) = public.current_user_email()
    )
  );

drop policy if exists tenant_insert_tenants on public.tenants;
create policy tenant_insert_tenants
  on public.tenants
  for insert
  to authenticated
  with check (
    public.current_user_email() <> ''
    and lower(coalesce(created_by_email, '')) = public.current_user_email()
  );

drop policy if exists tenant_insert_memberships_creator_bootstrap on public.tenant_memberships;
create policy tenant_insert_memberships_creator_bootstrap
  on public.tenant_memberships
  for insert
  to authenticated
  with check (
    public.current_user_email() <> ''
    and exists (
      select 1
      from public.tenants t
      where t.id = tenant_memberships.tenant_id
        and lower(coalesce(t.created_by_email, '')) = public.current_user_email()
    )
    and lower(user_email) = public.current_user_email()
    and role = 'tenant_admin'::public.tenant_membership_role
  );

-- ---------------------------------------------------------------------------
-- 6. prayers / prayer_updates: members could self-approve (insert approved rows), edit or
--    re-approve any prayer/update in their church, and anon could insert prayers for any
--    church by naming a member's email (tenant_insert_prayers_membership_by_row_email).
--    Members insert pending rows only; only tenant admins update (moderation). Client
--    member flows already insert approval_status = 'pending' and never update rows
--    (prayed-for counts go through increment_prayed_for_count).
-- ---------------------------------------------------------------------------

drop policy if exists tenant_insert_prayers_membership_by_row_email on public.prayers;

drop policy if exists tenant_insert_prayers on public.prayers;
create policy tenant_insert_prayers
  on public.prayers
  for insert
  to authenticated
  with check (
    public.is_tenant_member(tenant_id)
    and public.tenant_has_churches_plan(tenant_id)
    and (
      public.is_tenant_admin(tenant_id)
      or coalesce(approval_status, 'pending') = 'pending'
    )
  );

drop policy if exists tenant_update_prayers on public.prayers;
drop policy if exists tenant_update_prayers_admin on public.prayers;
create policy tenant_update_prayers_admin
  on public.prayers
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

drop policy if exists tenant_insert_prayer_updates on public.prayer_updates;
create policy tenant_insert_prayer_updates
  on public.prayer_updates
  for insert
  to authenticated
  with check (
    public.is_tenant_member(tenant_id)
    and public.tenant_has_churches_plan(tenant_id)
    and exists (
      select 1
      from public.prayers p
      where p.id = prayer_updates.prayer_id
        and p.tenant_id = prayer_updates.tenant_id
    )
    and (
      public.is_tenant_admin(tenant_id)
      or coalesce(approval_status, 'pending') = 'pending'
    )
  );

drop policy if exists tenant_update_prayer_updates on public.prayer_updates;
drop policy if exists tenant_update_prayer_updates_admin on public.prayer_updates;
create policy tenant_update_prayer_updates_admin
  on public.prayer_updates
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- ---------------------------------------------------------------------------
-- 7. memorization_recite_usage: policy targeted anon; signed-in tenant admins only.
-- ---------------------------------------------------------------------------

drop policy if exists memorization_recite_usage_tenant_admin_select on public.memorization_recite_usage;
create policy memorization_recite_usage_tenant_admin_select
  on public.memorization_recite_usage
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 8. SECURITY DEFINER RPCs that only Edge Functions (service role) call.
--    apply_tenant_stripe_billing had no auth check and was executable by anon: anyone with
--    the publishable key could set any church to plan_tier = 'churches', status 'active'.
-- ---------------------------------------------------------------------------

revoke all on function public.apply_tenant_stripe_billing(
  uuid, public.plan_tier, public.plan_status, text, text, boolean,
  timestamptz, timestamptz, timestamptz, boolean, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.apply_tenant_stripe_billing(
  uuid, public.plan_tier, public.plan_status, text, text, boolean,
  timestamptz, timestamptz, timestamptz, boolean, timestamptz, boolean
) to service_role;

revoke all on function public.downgrade_church_tenant_after_access_end(uuid) from public, anon, authenticated;
grant execute on function public.downgrade_church_tenant_after_access_end(uuid) to service_role;

revoke all on function public.list_church_tenants_due_for_billing_downgrade() from public, anon, authenticated;
grant execute on function public.list_church_tenants_due_for_billing_downgrade() to service_role;

revoke all on function public.get_user_prayer_hour_reminders_due_now() from public, anon, authenticated;
grant execute on function public.get_user_prayer_hour_reminders_due_now() to service_role;

revoke all on function public.get_user_memorization_hour_reminders_due_now() from public, anon, authenticated;
grant execute on function public.get_user_memorization_hour_reminders_due_now() to service_role;

revoke all on function public.get_user_prayer_item_reminders_due_now() from public, anon, authenticated;
grant execute on function public.get_user_prayer_item_reminders_due_now() to service_role;

-- Internal catalog helpers (called only from apply_ibcd_memorization_recommendations and the
-- tenant-insert trigger, both SECURITY DEFINER). Had no auth check.
revoke all on function public._merge_ibcd_memorization_catalog(uuid) from public, anon, authenticated;
grant execute on function public._merge_ibcd_memorization_catalog(uuid) to service_role;

revoke all on function public.seed_ibcd_memorization_recommendations(uuid) from public, anon, authenticated;
grant execute on function public.seed_ibcd_memorization_recommendations(uuid) to service_role;

-- No callers; returned any email's memberships + Stripe ids to anon.
revoke all on function public.get_tenant_context_by_email(text) from public, anon, authenticated;
grant execute on function public.get_tenant_context_by_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Tenant-admin settings RPCs trusted p_email: if p_email named ANY tenant admin, that
--    admin's rights were used, even for anon. Caller now comes only from auth.users/JWT and
--    p_email must match it when supplied (same fix as 20260924180000 for
--    grant_tenant_admin_membership). Bodies are otherwise unchanged from prayer-paid.
-- ---------------------------------------------------------------------------

create or replace function public.get_tenant_mail_identity(p_tenant_id uuid, p_email text default null::text)
 returns table(mail_from_name text, mail_from_local_part text, mail_reply_to text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  return query
  select
    ts.mail_from_name,
    ts.mail_from_local_part,
    ts.mail_reply_to
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
end;
$function$;

create or replace function public.update_tenant_mail_identity(p_tenant_id uuid, p_mail_from_name text default null::text, p_mail_from_local_part text default null::text, p_mail_reply_to text default null::text, p_email text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
  v_name text := nullif(btrim(coalesce(p_mail_from_name, '')), '');
  v_local text := nullif(lower(btrim(coalesce(p_mail_from_local_part, ''))), '');
  v_reply text := nullif(lower(btrim(coalesce(p_mail_reply_to, ''))), '');
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  if v_name is not null
     and (
       char_length(v_name) > 78
       or v_name ~ E'[<>\\n\\r]'
     ) then
    raise exception 'Invalid mail_from_name';
  end if;

  if v_local is not null
     and v_local !~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$' then
    raise exception 'Invalid mail_from_local_part';
  end if;

  if v_reply is not null
     and (
       char_length(v_reply) > 254
       or v_reply ~ E'[<>\\n\\r\\s]'
       or v_reply !~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
     ) then
    raise exception 'Invalid mail_reply_to';
  end if;

  insert into public.tenant_settings (
    tenant_id,
    mail_from_name,
    mail_from_local_part,
    mail_reply_to,
    updated_at
  )
  values (
    p_tenant_id,
    v_name,
    v_local,
    v_reply,
    now()
  )
  on conflict (tenant_id) do update set
    mail_from_name = excluded.mail_from_name,
    mail_from_local_part = excluded.mail_from_local_part,
    mail_reply_to = excluded.mail_reply_to,
    updated_at = excluded.updated_at;
end;
$function$;

create or replace function public.get_tenant_branding_settings(p_tenant_id uuid, p_email text default null::text)
 returns table(app_title text, church_website_url text, use_logo boolean, light_mode_logo_blob text, dark_mode_logo_blob text, branding_last_modified timestamp with time zone)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  return query
  select
    ts.app_title,
    ts.church_website_url,
    ts.use_logo,
    ts.light_mode_logo_blob,
    ts.dark_mode_logo_blob,
    ts.branding_last_modified
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
end;
$function$;

create or replace function public.update_tenant_branding_settings(p_tenant_id uuid, p_app_title text, p_use_logo boolean, p_light_mode_logo_blob text, p_dark_mode_logo_blob text, p_church_website_url text default null::text, p_email text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  insert into public.tenant_settings (
    tenant_id,
    app_title,
    use_logo,
    light_mode_logo_blob,
    dark_mode_logo_blob,
    church_website_url,
    updated_at
  )
  values (
    p_tenant_id,
    p_app_title,
    coalesce(p_use_logo, false),
    p_light_mode_logo_blob,
    p_dark_mode_logo_blob,
    nullif(trim(coalesce(p_church_website_url, '')), ''),
    now()
  )
  on conflict (tenant_id) do update set
    app_title = excluded.app_title,
    use_logo = excluded.use_logo,
    light_mode_logo_blob = excluded.light_mode_logo_blob,
    dark_mode_logo_blob = excluded.dark_mode_logo_blob,
    church_website_url = excluded.church_website_url,
    updated_at = excluded.updated_at;
end;
$function$;

create or replace function public.get_tenant_reminder_settings(p_tenant_id uuid, p_email text default null::text)
 returns table(enable_reminders boolean, reminder_interval_days integer, enable_auto_archive boolean, days_before_archive integer)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  return query
  select
    ts.enable_reminders,
    ts.reminder_interval_days,
    ts.enable_auto_archive,
    ts.days_before_archive
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
end;
$function$;

create or replace function public.update_tenant_reminder_settings(p_tenant_id uuid, p_enable_reminders boolean, p_reminder_interval_days integer, p_enable_auto_archive boolean, p_days_before_archive integer, p_email text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  insert into public.tenant_settings (
    tenant_id,
    enable_reminders,
    reminder_interval_days,
    enable_auto_archive,
    days_before_archive,
    updated_at
  )
  values (
    p_tenant_id,
    coalesce(p_enable_reminders, false),
    greatest(1, least(90, coalesce(p_reminder_interval_days, 7))),
    coalesce(p_enable_auto_archive, false),
    greatest(1, least(90, coalesce(p_days_before_archive, 7))),
    now()
  )
  on conflict (tenant_id) do update set
    enable_reminders = excluded.enable_reminders,
    reminder_interval_days = excluded.reminder_interval_days,
    enable_auto_archive = excluded.enable_auto_archive,
    days_before_archive = excluded.days_before_archive,
    updated_at = excluded.updated_at;
end;
$function$;

create or replace function public.get_tenant_prayer_encouragement_settings(p_tenant_id uuid, p_email text default null::text)
 returns table(prayer_encouragement_enabled boolean, prayer_encouragement_cooldown_hours integer, prayer_encouragement_count_visible_to_all boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  return query
  select
    ts.prayer_encouragement_enabled,
    ts.prayer_encouragement_cooldown_hours,
    ts.prayer_encouragement_count_visible_to_all
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
end;
$function$;

create or replace function public.update_tenant_prayer_encouragement_settings(p_tenant_id uuid, p_prayer_encouragement_enabled boolean, p_prayer_encouragement_cooldown_hours integer, p_prayer_encouragement_count_visible_to_all boolean, p_email text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  insert into public.tenant_settings (
    tenant_id,
    prayer_encouragement_enabled,
    prayer_encouragement_cooldown_hours,
    prayer_encouragement_count_visible_to_all,
    updated_at
  )
  values (
    p_tenant_id,
    coalesce(p_prayer_encouragement_enabled, false),
    greatest(1, least(168, coalesce(p_prayer_encouragement_cooldown_hours, 4))),
    coalesce(p_prayer_encouragement_count_visible_to_all, false),
    now()
  )
  on conflict (tenant_id) do update set
    prayer_encouragement_enabled = excluded.prayer_encouragement_enabled,
    prayer_encouragement_cooldown_hours = excluded.prayer_encouragement_cooldown_hours,
    prayer_encouragement_count_visible_to_all = excluded.prayer_encouragement_count_visible_to_all,
    updated_at = excluded.updated_at;
end;
$function$;

create or replace function public.get_tenant_memorization_recite_settings(p_tenant_id uuid, p_email text default null::text)
 returns table(memorization_recite_enabled boolean, memorization_recite_stt_provider text, memorization_recite_whisper_model text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  return query
  select
    ts.memorization_recite_enabled,
    ts.memorization_recite_stt_provider,
    ts.memorization_recite_whisper_model
  from public.tenant_settings ts
  where ts.tenant_id = p_tenant_id;
end;
$function$;

create or replace function public.update_tenant_memorization_recite_settings(p_tenant_id uuid, p_memorization_recite_enabled boolean, p_memorization_recite_stt_provider text, p_email text default null::text, p_memorization_recite_whisper_model text default 'whisper-1'::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
  v_provider text := lower(trim(coalesce(p_memorization_recite_stt_provider, 'browser')));
  v_model text := lower(trim(coalesce(p_memorization_recite_whisper_model, 'whisper-1')));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  if v_provider not in ('browser', 'whisper') then
    raise exception 'Invalid stt provider';
  end if;

  if v_model not in ('whisper-1', 'gpt-4o-mini-transcribe') then
    raise exception 'Invalid whisper model';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  insert into public.tenant_settings (
    tenant_id,
    memorization_recite_enabled,
    memorization_recite_stt_provider,
    memorization_recite_whisper_model,
    updated_at
  )
  values (
    p_tenant_id,
    coalesce(p_memorization_recite_enabled, false),
    v_provider,
    v_model,
    now()
  )
  on conflict (tenant_id) do update set
    memorization_recite_enabled = excluded.memorization_recite_enabled,
    memorization_recite_stt_provider = excluded.memorization_recite_stt_provider,
    memorization_recite_whisper_model = excluded.memorization_recite_whisper_model,
    updated_at = excluded.updated_at;
end;
$function$;

create or replace function public.get_tenant_memorization_recite_usage_summary(p_tenant_id uuid, p_email text default null::text, p_start timestamp with time zone default date_trunc('month'::text, now()), p_end timestamp with time zone default now())
 returns table(attempt_count bigint, whisper_attempt_count bigint, browser_attempt_count bigint, total_audio_seconds numeric, billable_audio_seconds numeric, estimated_cost_usd numeric)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where u.stt_provider = 'whisper')::bigint,
    count(*) filter (where u.stt_provider = 'browser')::bigint,
    coalesce(sum(u.audio_seconds), 0),
    coalesce(sum(u.audio_seconds) filter (where u.billable), 0),
    coalesce(sum(u.estimated_cost_usd) filter (where u.billable), 0)
  from public.memorization_recite_usage u
  where u.tenant_id = p_tenant_id
    and u.created_at >= coalesce(p_start, '-infinity'::timestamptz)
    and u.created_at < coalesce(p_end, 'infinity'::timestamptz);
end;
$function$;

create or replace function public.ensure_tenant_email_templates(p_tenant_id uuid, p_email text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
  def_id uuid;
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  select id into def_id from public.tenants where slug = 'default-tenant' limit 1;
  if def_id is null then
    return;
  end if;

  insert into public.email_templates (
    tenant_id,
    template_key,
    name,
    subject,
    html_body,
    text_body,
    description,
    created_at,
    updated_at
  )
  select
    p_tenant_id,
    src.template_key,
    src.name,
    src.subject,
    src.html_body,
    src.text_body,
    src.description,
    src.created_at,
    src.updated_at
  from public.email_templates src
  where src.tenant_id = def_id
    and not exists (
      select 1
      from public.email_templates existing
      where existing.tenant_id = p_tenant_id
        and existing.template_key = src.template_key
    );
end;
$function$;

create or replace function public.ensure_tenant_prayer_types(p_tenant_id uuid, p_email text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
  def_id uuid;
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  select id into def_id from public.tenants where slug = 'default-tenant' limit 1;
  if def_id is not null and def_id != p_tenant_id then
    insert into public.prayer_types (tenant_id, name, display_order, is_active)
    select
      p_tenant_id,
      src.name,
      src.display_order,
      src.is_active
    from public.prayer_types src
    where src.tenant_id = def_id
      and not exists (
        select 1
        from public.prayer_types existing
        where existing.tenant_id = p_tenant_id
          and existing.name = src.name
      );
  end if;

  if not exists (select 1 from public.prayer_types pt where pt.tenant_id = p_tenant_id) then
    insert into public.prayer_types (tenant_id, name, display_order, is_active)
    values
      (p_tenant_id, 'Healing', 0, true),
      (p_tenant_id, 'Guidance', 1, true),
      (p_tenant_id, 'Thanksgiving', 2, true),
      (p_tenant_id, 'Protection', 3, true),
      (p_tenant_id, 'Family', 4, true),
      (p_tenant_id, 'Finances', 5, true),
      (p_tenant_id, 'Salvation', 6, true),
      (p_tenant_id, 'Missions', 7, true),
      (p_tenant_id, 'Other', 8, true);
  end if;
end;
$function$;

create or replace function public.create_tenant_for_user(p_name text, p_slug text, p_plan_tier plan_tier, p_plan_status plan_status default 'active'::plan_status, p_email text default null::text)
 returns tenants
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text;
  v_tenant public.tenants;
  v_slug text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
begin
  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  -- 20260927140000: caller identity comes only from the session (auth.users / JWT).
  -- p_email is a legacy hint; when supplied it must equal the caller.
  v_email := coalesce(
    nullif(v_from_auth, ''),
    nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '')
  );

  if v_email is not null and v_p_email != '' and v_p_email != v_email then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if p_plan_tier = 'churches'::public.plan_tier
     and not public.is_super_admin(v_email) then
    raise exception 'Church tenants are created after payment via complete_church_setup_for_user';
  end if;

  v_slug := lower(regexp_replace(trim(p_slug), '\s+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
  perform public.assert_tenant_slug_allowed(v_slug);

  insert into public.tenants (name, slug, plan_tier, plan_status, created_by_email)
  values (trim(p_name), v_slug, p_plan_tier, p_plan_status, v_email)
  returning * into v_tenant;

  insert into public.tenant_memberships (tenant_id, user_email, role)
  values (v_tenant.id, v_email, 'tenant_admin');

  return v_tenant;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 10. Super-admin list RPCs trusted p_actor_email / p_email: anon passing a super admin's
--     email got every church's approved prayers, every tenant, and the super-admin list
--     (verified read-only on prayer-paid 2026-09-26). Use the JWT; the email arg must match.
-- ---------------------------------------------------------------------------

create or replace function public.list_approved_prayers_for_super_admin(
  p_actor_email text,
  p_tenant_id uuid
)
returns setof public.prayers
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller text := public.current_user_email();
  v_email text := lower(trim(coalesce(p_actor_email, '')));
begin
  if p_tenant_id is null or v_caller = '' then
    return;
  end if;

  if v_email <> '' and v_email <> v_caller then
    return;
  end if;

  if not public.is_super_admin(v_caller) then
    return;
  end if;

  return query
  select p.*
  from public.prayers p
  where p.tenant_id = p_tenant_id
    and p.approval_status = 'approved'
    and public.tenant_has_churches_plan(p.tenant_id)
  order by p.created_at desc;
end;
$$;

create or replace function public.list_approved_prayer_updates_for_super_admin(
  p_actor_email text,
  p_tenant_id uuid,
  p_prayer_ids uuid[]
)
returns setof public.prayer_updates
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller text := public.current_user_email();
  v_email text := lower(trim(coalesce(p_actor_email, '')));
begin
  if v_caller = '' or p_tenant_id is null or p_prayer_ids is null or cardinality(p_prayer_ids) = 0 then
    return;
  end if;

  if v_email <> '' and v_email <> v_caller then
    return;
  end if;

  if not public.is_super_admin(v_caller) then
    return;
  end if;

  return query
  select pu.*
  from public.prayer_updates pu
  where pu.tenant_id = p_tenant_id
    and pu.prayer_id = any (p_prayer_ids)
    and pu.approval_status = 'approved'
    and public.tenant_has_churches_plan(pu.tenant_id)
  order by pu.created_at desc;
end;
$$;

create or replace function public.list_super_admins_for_caller(p_actor_email text)
returns table(user_email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := public.current_user_email();
  normalized text := lower(trim(coalesce(p_actor_email, '')));
begin
  if v_caller = '' then
    return;
  end if;

  if (normalized <> '' and normalized <> v_caller) or not public.is_super_admin(v_caller) then
    raise exception 'Not authorized';
  end if;

  return query
  select gr.user_email
  from public.global_roles gr
  where gr.role = 'super_admin'::public.global_role
  order by gr.user_email asc;
end;
$$;

create or replace function public.get_all_tenants_for_email(p_email text)
returns table(id uuid, name text, slug text, plan_tier public.plan_tier, plan_status public.plan_status)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller text := public.current_user_email();
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_caller = '' or (v_email <> '' and v_email <> v_caller) then
    return;
  end if;

  if not public.is_super_admin(v_caller) then
    return;
  end if;

  return query
  select t.id, t.name, t.slug, t.plan_tier, t.plan_status
  from public.tenants t
  order by t.name asc;
end;
$$;

-- Anyone could create/rename a user_subscriptions row for any email.
create or replace function public.upsert_user_subscription_free(
  p_email text,
  p_display_name text default null::text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
begin
  if v_email = '' then
    raise exception 'Email is required';
  end if;

  if public.current_user_email() = ''
     or (v_email <> public.current_user_email() and not public.is_super_admin()) then
    raise exception 'Not authorized';
  end if;

  insert into public.user_subscriptions (user_email, plan_tier, plan_status, display_name)
  values (v_email, 'free', 'active', v_name)
  on conflict (user_email) do update
    set display_name = coalesce(excluded.display_name, public.user_subscriptions.display_name),
        updated_at = now();
end;
$$;

-- Anyone (including anon) could bump any church's prayer count.
create or replace function public.increment_prayed_for_count(prayer_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update public.prayers p
  set prayed_for_count = coalesce(p.prayed_for_count, 0) + 1
  where p.id = increment_prayed_for_count.prayer_id
    and public.is_tenant_member(p.tenant_id)
    and public.tenant_has_churches_plan(p.tenant_id)
  returning p.prayed_for_count into new_count;
  return coalesce(new_count, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. EXECUTE sweep: no SECURITY DEFINER RPC is callable with only the publishable key,
--     except an explicit allowlist of pre-sign-in / public-landing helpers and the RLS
--     helper predicates (keeps policy evaluation from erroring for anon). Signed-in access
--     is preserved exactly where it existed (explicit grant replaces the PUBLIC grant).
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_had_auth boolean;
  v_anon_allow text[] := array[
    -- public landing / pre-sign-in
    'get_public_client_min_versions',
    'get_public_tenant_branding',
    'get_public_tenant_by_slug',
    'get_public_tenant_memorization_recite_settings',
    'get_public_tenant_prayer_encouragement',
    'get_platform_billing_settings',
    'is_login_allowed_email',
    'is_test_account_email',
    'is_tenant_slug_available',
    -- RLS helper predicates referenced by policies
    'is_super_admin',
    'is_tenant_admin',
    'is_tenant_member',
    'tenant_has_churches_plan',
    'can_use_unaffiliated_user_data',
    'is_prayer_group_member',
    'is_prayer_group_owner'
  ];
begin
  for r in
    select
      p.oid,
      format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prokind = 'f'
      and pg_get_function_result(p.oid) not in ('trigger', 'event_trigger')
      and not (p.proname = any (v_anon_allow))
  loop
    v_had_auth := has_function_privilege('authenticated', r.oid, 'EXECUTE');
    execute format('revoke execute on function %s from public, anon', r.sig);
    if v_had_auth then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
