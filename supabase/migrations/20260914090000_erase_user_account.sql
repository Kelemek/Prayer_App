-- Account erasure: service-role-only RPC for delete-account Edge Function.
-- keep_prayers: anonymize shared prayer PII; wipe_prayers: delete authored prayer rows.

create table if not exists public.account_erasure_events (
  auth_user_id uuid primary key,
  user_email text not null,
  mode text not null check (mode in ('keep_prayers', 'wipe_prayers')),
  completed_at timestamptz not null default now(),
  notes jsonb
);

comment on table public.account_erasure_events is
  'One row per successfully erased auth user; used for idempotency and audit. No client access.';

alter table public.account_erasure_events enable row level security;

revoke all on table public.account_erasure_events from public, anon, authenticated;
grant all on table public.account_erasure_events to service_role;

create or replace function public.erase_user_account(
  p_user_id uuid,
  p_email text,
  p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_mode text := trim(coalesce(p_mode, ''));
  v_deleted_email constant text := 'deleted-user@invalid';
  v_deleted_name constant text := 'Deleted user';
  v_already boolean := false;
  v_counts jsonb := '{}'::jsonb;
  v_n bigint;
  v_pro_stripe_ids text[] := array[]::text[];
  v_church_stripe_ids text[] := array[]::text[];
  v_group_id uuid;
  v_promote_id uuid;
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;
  if v_email = '' then
    raise exception 'email required';
  end if;
  if v_mode not in ('keep_prayers', 'wipe_prayers') then
    raise exception 'invalid mode';
  end if;

  select exists (
    select 1 from public.account_erasure_events e where e.auth_user_id = p_user_id
  ) into v_already;

  select coalesce(array_agg(distinct t.stripe_customer_id), array[]::text[])
  into v_church_stripe_ids
  from (
    select stripe_customer_id from public.tenants where stripe_customer_id is not null
    union
    select stripe_customer_id from public.tenant_subscriptions where stripe_customer_id is not null
  ) t;

  select coalesce(array_agg(distinct x.cid), array[]::text[])
  into v_pro_stripe_ids
  from (
    select us.stripe_customer_id as cid
    from public.user_subscriptions us
    where lower(trim(us.user_email)) = v_email
      and us.stripe_customer_id is not null
      and trim(us.stripe_customer_id) <> ''
    union
    select bl.stripe_customer_id as cid
    from public.billing_signup_leads bl
    where bl.kind = 'pro'
      and (
        lower(trim(bl.user_email)) = v_email
        or bl.user_id = p_user_id
      )
      and bl.stripe_customer_id is not null
      and trim(bl.stripe_customer_id) <> ''
  ) x
  where not (x.cid = any (v_church_stripe_ids));

  update public.deletion_requests
  set reviewed_by = null
  where reviewed_by = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('deletion_requests_reviewed_by_nulled', v_n);

  update public.update_deletion_requests
  set reviewed_by = null
  where reviewed_by = p_user_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('update_deletion_requests_reviewed_by_nulled', v_n);

  for v_group_id in
    select distinct m.group_id
    from public.prayer_group_members m
    where lower(trim(m.user_email)) = v_email
  loop
    if exists (
      select 1
      from public.prayer_group_members m
      where m.group_id = v_group_id
        and lower(trim(m.user_email)) = v_email
        and m.role = 'owner'
    ) and not exists (
      select 1
      from public.prayer_group_members m
      where m.group_id = v_group_id
        and m.role = 'owner'
        and lower(trim(m.user_email)) <> v_email
    ) then
      select m.id
      into v_promote_id
      from public.prayer_group_members m
      where m.group_id = v_group_id
        and lower(trim(m.user_email)) <> v_email
      order by m.created_at
      limit 1;

      if v_promote_id is not null then
        update public.prayer_group_members
        set role = 'owner', updated_at = now()
        where id = v_promote_id;
      end if;
    end if;
  end loop;

  delete from public.prayer_group_members
  where lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('prayer_group_members_deleted', v_n);

  delete from public.prayer_groups g
  where not exists (
    select 1 from public.prayer_group_members m where m.group_id = g.id
  );
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('prayer_groups_deleted_empty', v_n);

  update public.prayer_groups
  set created_by_email = v_deleted_email, updated_at = now()
  where lower(trim(created_by_email)) = v_email;

  update public.prayer_group_members
  set invited_by_email = v_deleted_email, updated_at = now()
  where lower(trim(invited_by_email)) = v_email;

  if v_mode = 'wipe_prayers' then
    delete from public.group_prayer_updates
    where lower(trim(author_email)) = v_email;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('group_prayer_updates_deleted', v_n);

    delete from public.group_prayers
    where lower(trim(email)) = v_email;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('group_prayers_deleted', v_n);

    delete from public.prayer_updates
    where lower(trim(author_email)) = v_email;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('prayer_updates_deleted', v_n);

    delete from public.prayers
    where lower(trim(email::text)) = v_email;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('prayers_deleted', v_n);

    delete from public.personal_prayers
    where lower(trim(user_email)) = v_email;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('personal_prayers_deleted', v_n);
  else
    update public.group_prayer_updates
    set
      author_email = v_deleted_email,
      author = v_deleted_name,
      updated_at = now()
    where lower(trim(author_email)) = v_email;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('group_prayer_updates_anonymized', v_n);

    update public.group_prayers
    set
      email = v_deleted_email,
      requester = v_deleted_name,
      is_anonymous = true,
      updated_at = now()
    where lower(trim(email)) = v_email;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('group_prayers_anonymized', v_n);

    update public.prayer_updates
    set
      author_email = v_deleted_email,
      author = v_deleted_name,
      is_anonymous = true,
      updated_at = now()
    where lower(trim(author_email)) = v_email;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('prayer_updates_anonymized', v_n);

    update public.prayers
    set
      email = v_deleted_email,
      requester = v_deleted_name,
      is_anonymous = true,
      updated_at = now()
    where lower(trim(email::text)) = v_email;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('prayers_anonymized', v_n);

    update public.personal_prayer_updates ppu
    set
      author_email = v_deleted_email,
      author = v_deleted_name,
      updated_at = now()
    from public.personal_prayers pp
    where pp.id = ppu.personal_prayer_id
      and lower(trim(pp.user_email)) = v_email;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('personal_prayer_updates_anonymized', v_n);

    update public.personal_prayers
    set
      user_email = v_deleted_email,
      updated_at = now()
    where lower(trim(user_email)) = v_email;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('personal_prayers_anonymized', v_n);
  end if;

  delete from public.personal_categories
  where lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('personal_categories_deleted', v_n);

  delete from public.personal_prayer_category_colors
  where lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('personal_prayer_category_colors_deleted', v_n);

  delete from public.deletion_requests
  where lower(trim(requested_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('deletion_requests_deleted', v_n);

  delete from public.update_deletion_requests
  where lower(trim(requested_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('update_deletion_requests_deleted', v_n);

  delete from public.status_change_requests
  where lower(trim(coalesce(requested_email, ''))) = v_email
     or lower(trim(requested_by::text)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('status_change_requests_deleted', v_n);

  delete from public.tenant_memberships
  where auth_user_id = p_user_id
     or lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('tenant_memberships_deleted', v_n);

  delete from public.device_tokens
  where lower(trim(user_email::text)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('device_tokens_deleted', v_n);

  delete from public.push_notification_log
  where lower(trim(user_email::text)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('push_notification_log_deleted', v_n);

  delete from public.verification_codes
  where lower(trim(email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('verification_codes_deleted', v_n);

  delete from public.billing_signup_leads
  where user_id = p_user_id
     or lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('billing_signup_leads_deleted', v_n);

  delete from public.user_subscriptions
  where lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('user_subscriptions_deleted', v_n);

  delete from public.account_approval_requests
  where lower(trim(email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('account_approval_requests_deleted', v_n);

  delete from public.tenant_invites
  where lower(trim(email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('tenant_invites_deleted', v_n);

  delete from public.email_queue
  where lower(trim(recipient)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('email_queue_deleted', v_n);

  delete from public.global_roles
  where lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('global_roles_deleted', v_n);

  delete from public.memorized_items
  where lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('memorized_items_deleted', v_n);

  delete from public.memorization_recite_usage
  where lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('memorization_recite_usage_deleted', v_n);

  delete from public.user_memorization_hour_reminders
  where lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('user_memorization_hour_reminders_deleted', v_n);

  delete from public.user_prayer_hour_reminders
  where lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('user_prayer_hour_reminders_deleted', v_n);

  delete from public.user_prayer_item_reminders
  where lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('user_prayer_item_reminders_deleted', v_n);

  delete from public.prompt_prayed_for_counts
  where lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('prompt_prayed_for_counts_deleted', v_n);

  delete from public.badge_read_receipts
  where lower(trim(user_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('badge_read_receipts_deleted', v_n);

  delete from public.analytics a
  where (
    a.event_data ? 'email'
    and lower(trim(a.event_data ->> 'email')) = v_email
  ) or (
    a.event_data ? 'user_email'
    and lower(trim(a.event_data ->> 'user_email')) = v_email
  );
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('analytics_deleted', v_n);

  update public.tenants
  set created_by_email = v_deleted_email, updated_at = now()
  where lower(trim(created_by_email)) = v_email;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('tenants_created_by_anonymized', v_n);

  insert into public.account_erasure_events (auth_user_id, user_email, mode, notes)
  values (p_user_id, v_email, v_mode, v_counts)
  on conflict (auth_user_id) do update
  set
    user_email = excluded.user_email,
    mode = excluded.mode,
    completed_at = now(),
    notes = excluded.notes;

  return jsonb_build_object(
    'already_erased', v_already,
    'mode', v_mode,
    'counts', v_counts,
    'pro_stripe_customer_ids', to_jsonb(v_pro_stripe_ids)
  );
end;
$$;

revoke all on function public.erase_user_account(uuid, text, text) from public, anon, authenticated;
grant execute on function public.erase_user_account(uuid, text, text) to service_role;
