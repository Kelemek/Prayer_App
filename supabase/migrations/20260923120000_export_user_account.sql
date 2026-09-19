-- GDPR-style self-serve data export for the authenticated caller.
-- Inventory mirrors erase_user_account (account, prayers, prefs, memberships, plus
-- other user-keyed rows that delete already knows about). No caller-supplied user id.
-- Not legal advice.

create or replace function public.export_user_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(trim(coalesce(public.current_user_email(), '')));
  v_account jsonb := '{}'::jsonb;
  v_payload jsonb;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if v_email = '' then
    select lower(trim(u.email))
    into v_email
    from auth.users u
    where u.id = v_user_id;
  end if;

  if v_email is null or v_email = '' then
    raise exception 'email required';
  end if;

  select jsonb_build_object(
    'auth_user_id', u.id,
    'email', lower(trim(u.email)),
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'email_confirmed_at', u.email_confirmed_at
  )
  into v_account
  from auth.users u
  where u.id = v_user_id;

  if v_account is null then
    v_account := jsonb_build_object(
      'auth_user_id', v_user_id,
      'email', v_email
    );
  end if;

  v_payload := jsonb_build_object(
    'schema_version', 1,
    'exported_at', now(),
    'scope', jsonb_build_object(
      'auth_user_id', v_user_id,
      'email', v_email,
      'note', 'Rows are limited to this authenticated user across every church they belong to.'
    ),
    'account', v_account,
    'memberships', coalesce((
      select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
      from (
        select
          m.id,
          m.tenant_id,
          t.name as tenant_name,
          t.slug as tenant_slug,
          m.role,
          m.name,
          m.user_email,
          m.auth_user_id,
          m.is_active,
          m.is_blocked,
          m.created_at,
          m.updated_at,
          m.last_activity_date
        from public.tenant_memberships m
        left join public.tenants t on t.id = m.tenant_id
        where m.auth_user_id = v_user_id
           or lower(trim(m.user_email)) = v_email
      ) s
    ), '[]'::jsonb),
    'preferences', jsonb_build_object(
      'membership_preferences', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.tenant_id)
        from (
          select
            m.tenant_id,
            t.name as tenant_name,
            m.user_email,
            m.receive_admin_emails,
            m.receive_push,
            m.receive_admin_push,
            m.badge_functionality_enabled,
            m.default_prayer_view,
            m.memorization_strict_mode,
            m.show_pray_for_button,
            m.show_praying_count,
            m.personal_prayer_cooldown_hours,
            m.in_planning_center,
            m.planning_center_checked_at
          from public.tenant_memberships m
          left join public.tenants t on t.id = m.tenant_id
          where m.auth_user_id = v_user_id
             or lower(trim(m.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'personal_categories', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.display_order, s.created_at)
        from (
          select
            c.id,
            c.tenant_id,
            c.user_email,
            c.name,
            c.display_order,
            c.color,
            c.created_at,
            c.updated_at
          from public.personal_categories c
          where lower(trim(c.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'prayer_hour_reminders', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.local_hour)
        from (
          select
            r.id,
            r.user_email,
            r.iana_timezone,
            r.local_hour,
            r.created_at
          from public.user_prayer_hour_reminders r
          where lower(trim(r.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'memorization_hour_reminders', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            r.id,
            r.user_email,
            r.tenant_id,
            r.iana_timezone,
            r.local_hour,
            r.created_at
          from public.user_memorization_hour_reminders r
          where lower(trim(r.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'prayer_item_reminders', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            r.id,
            r.tenant_id,
            r.user_email,
            r.prayer_kind,
            r.prayer_id,
            r.title_snapshot,
            r.prayer_for_snapshot,
            r.mode,
            r.iana_timezone,
            r.local_hour,
            r.local_minute,
            r.local_date,
            r.local_weekday,
            r.last_sent_at,
            r.created_at
          from public.user_prayer_item_reminders r
          where lower(trim(r.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'client_device_note',
        'Theme and text size live on this device only and are not stored on the server.'
    ),
    'prayers', jsonb_build_object(
      'church_prayers', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            p.id,
            p.tenant_id,
            p.title,
            p.description,
            p.prayer_for,
            p.status,
            p.requester,
            p.email,
            p.is_anonymous,
            p.approval_status,
            p.date_requested,
            p.date_answered,
            p.is_shared_personal_prayer,
            p.prayed_for_count,
            p.content_kind,
            p.verse_reference,
            p.verse_translation,
            p.created_at,
            p.updated_at
          from public.prayers p
          where lower(trim(p.email::text)) = v_email
        ) s
      ), '[]'::jsonb),
      'church_prayer_updates', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            u.id,
            u.prayer_id,
            u.tenant_id,
            u.content,
            u.author,
            u.author_email,
            u.is_anonymous,
            u.approval_status,
            u.mark_as_answered,
            u.created_at,
            u.updated_at
          from public.prayer_updates u
          where lower(trim(u.author_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'personal_prayers', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.display_order, s.created_at)
        from (
          select
            p.id,
            p.tenant_id,
            p.user_email,
            p.title,
            p.description,
            p.prayer_for,
            p.category_id,
            p.display_order,
            p.prayed_for_count,
            p.created_at,
            p.updated_at
          from public.personal_prayers p
          where lower(trim(p.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'personal_prayer_updates', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            u.id,
            u.personal_prayer_id,
            u.content,
            u.author,
            u.author_email,
            u.mark_as_answered,
            u.created_at,
            u.updated_at
          from public.personal_prayer_updates u
          join public.personal_prayers p on p.id = u.personal_prayer_id
          where lower(trim(p.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'group_prayers', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            p.id,
            p.group_id,
            p.title,
            p.description,
            p.prayer_for,
            p.status,
            p.requester,
            p.email,
            p.is_anonymous,
            p.date_requested,
            p.date_answered,
            p.prayed_for_count,
            p.created_at,
            p.updated_at
          from public.group_prayers p
          where lower(trim(p.email)) = v_email
        ) s
      ), '[]'::jsonb),
      'group_prayer_updates', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            u.id,
            u.group_prayer_id,
            u.content,
            u.author,
            u.author_email,
            u.mark_as_answered,
            u.created_at,
            u.updated_at
          from public.group_prayer_updates u
          where lower(trim(u.author_email)) = v_email
        ) s
      ), '[]'::jsonb)
    ),
    'groups', jsonb_build_object(
      'memberships', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            m.id,
            m.group_id,
            g.name as group_name,
            m.user_email,
            m.role,
            m.name,
            m.is_active,
            m.display_order,
            m.created_at
          from public.prayer_group_members m
          left join public.prayer_groups g on g.id = m.group_id
          where lower(trim(m.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'created_groups', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            g.id,
            g.name,
            g.created_by_email,
            g.created_from_tenant_id,
            g.created_at
          from public.prayer_groups g
          where lower(trim(g.created_by_email)) = v_email
        ) s
      ), '[]'::jsonb)
    ),
    'memorization', jsonb_build_object(
      'memorized_items', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            i.id,
            i.user_email,
            i.tenant_id,
            i.reference,
            i.text,
            i.translation,
            i.kind,
            i.bible_books_scope,
            i.date_added,
            i.last_practiced_at,
            i.created_at,
            i.updated_at
          from public.memorized_items i
          where lower(trim(i.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'recite_usage', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            u.id,
            u.tenant_id,
            u.user_email,
            u.memorized_item_id,
            u.stt_provider,
            u.audio_seconds,
            u.model,
            u.estimated_cost_usd,
            u.created_at
          from public.memorization_recite_usage u
          where lower(trim(u.user_email)) = v_email
        ) s
      ), '[]'::jsonb)
    ),
    'billing', jsonb_build_object(
      'user_subscriptions', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb)
        from (
          select
            us.user_email,
            us.plan_tier,
            us.plan_status,
            us.source,
            us.display_name,
            us.stripe_customer_id,
            us.stripe_subscription_id,
            us.current_period_end,
            us.created_at,
            us.updated_at
          from public.user_subscriptions us
          where lower(trim(us.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'billing_signup_leads', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            bl.id,
            bl.kind,
            bl.user_email,
            bl.user_id,
            bl.status,
            bl.stripe_customer_id,
            bl.stripe_subscription_id,
            bl.tenant_id,
            bl.expires_at,
            bl.consumed_at,
            bl.created_at
          from public.billing_signup_leads bl
          where bl.user_id = v_user_id
             or lower(trim(bl.user_email)) = v_email
        ) s
      ), '[]'::jsonb)
    ),
    'other', jsonb_build_object(
      'global_roles', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb)
        from (
          select gr.id, gr.user_email, gr.role, gr.created_at
          from public.global_roles gr
          where lower(trim(gr.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'tenant_invites', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            i.id,
            i.tenant_id,
            i.email,
            i.status,
            i.invited_by_email,
            i.expires_at,
            i.accepted_at,
            i.created_at
          from public.tenant_invites i
          where lower(trim(i.email)) = v_email
        ) s
      ), '[]'::jsonb),
      'account_approval_requests', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            a.id,
            a.email,
            a.first_name,
            a.last_name,
            a.approval_status,
            a.affiliation_reason,
            a.tenant_id,
            a.created_at
          from public.account_approval_requests a
          where lower(trim(a.email)) = v_email
        ) s
      ), '[]'::jsonb),
      'feedback_submissions', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            f.id,
            f.auth_user_id,
            f.user_email,
            f.user_name,
            f.tenant_id,
            f.title,
            f.description,
            f.feedback_type,
            f.platform,
            f.page_url,
            f.created_at
          from public.feedback_submissions f
          where f.auth_user_id = v_user_id
             or lower(trim(f.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'deletion_requests', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            d.id,
            d.prayer_id,
            d.reason,
            d.requested_email,
            d.approval_status,
            d.tenant_id,
            d.created_at
          from public.deletion_requests d
          where lower(trim(d.requested_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'update_deletion_requests', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            d.id,
            d.update_id,
            d.reason,
            d.requested_email,
            d.approval_status,
            d.tenant_id,
            d.created_at
          from public.update_deletion_requests d
          where lower(trim(d.requested_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'device_tokens', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            dt.id,
            dt.user_email,
            dt.platform,
            dt.created_at,
            dt.last_seen_at
          from public.device_tokens dt
          where lower(trim(dt.user_email::text)) = v_email
        ) s
      ), '[]'::jsonb),
      'push_notification_log', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.sent_at)
        from (
          select
            l.id,
            l.user_email,
            l.title,
            l.body,
            l.sent_at,
            l.delivery_status
          from public.push_notification_log l
          where lower(trim(l.user_email::text)) = v_email
        ) s
      ), '[]'::jsonb),
      'prompt_prayed_for_counts', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb)
        from (
          select c.prompt_id, c.user_email, c.prayed_for_count, c.updated_at
          from public.prompt_prayed_for_counts c
          where lower(trim(c.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'badge_read_receipts', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb)
        from (
          select b.tenant_id, b.user_email, b.item_kind, b.item_id, b.read_at
          from public.badge_read_receipts b
          where lower(trim(b.user_email)) = v_email
        ) s
      ), '[]'::jsonb),
      'analytics', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select a.id, a.event_type, a.event_data, a.tenant_id, a.created_at
          from public.analytics a
          where (
            a.event_data ? 'email'
            and lower(trim(a.event_data ->> 'email')) = v_email
          ) or (
            a.event_data ? 'user_email'
            and lower(trim(a.event_data ->> 'user_email')) = v_email
          )
        ) s
      ), '[]'::jsonb),
      'email_queue', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select
            q.id,
            q.recipient,
            q.template_key,
            q.status,
            q.attempts,
            q.tenant_id,
            q.created_at
          from public.email_queue q
          where lower(trim(q.recipient)) = v_email
        ) s
      ), '[]'::jsonb),
      'tenants_created', coalesce((
        select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
        from (
          select t.id, t.name, t.slug, t.created_by_email, t.created_at
          from public.tenants t
          where lower(trim(t.created_by_email)) = v_email
        ) s
      ), '[]'::jsonb)
    ),
    'omitted', jsonb_build_array(
      'verification_codes',
      'device_tokens.token',
      'billing_signup_leads.token',
      'tenant_invites.token',
      'tenant_memberships.unsubscribe_token'
    )
  );

  return v_payload;
end;
$$;

comment on function public.export_user_account() is
  'Authenticated caller only. Returns a JSON package of that user''s data across all tenants. Mirrors erase_user_account inventory. No parameters.';

revoke all on function public.export_user_account() from public, anon, service_role;
grant execute on function public.export_user_account() to authenticated, service_role;
