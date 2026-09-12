-- Pay-first Church + Pro signup: user-scoped leads, no church tenant until paid.
-- Seed transactional templates. Tighten create_tenant_for_user (super_admin only for churches).

-- ---------------------------------------------------------------------------
-- Enums + table
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'billing_signup_kind') then
    create type public.billing_signup_kind as enum ('church', 'pro');
  end if;
  if not exists (select 1 from pg_type where typname = 'billing_signup_status') then
    create type public.billing_signup_status as enum (
      'pending',
      'paid_pending_setup',
      'consumed',
      'expired',
      'canceled'
    );
  end if;
end
$$;

create table if not exists public.billing_signup_leads (
  id uuid primary key default gen_random_uuid(),
  kind public.billing_signup_kind not null,
  token text not null unique,
  user_email text not null,
  user_id uuid,
  status public.billing_signup_status not null default 'pending',
  stripe_customer_id text,
  stripe_subscription_id text,
  tenant_id uuid references public.tenants(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_signup_leads_email_kind_idx
  on public.billing_signup_leads (user_email, kind);

create index if not exists billing_signup_leads_stripe_subscription_idx
  on public.billing_signup_leads (stripe_subscription_id)
  where stripe_subscription_id is not null;

create unique index if not exists billing_signup_leads_open_kind_email
  on public.billing_signup_leads (kind, user_email)
  where status in ('pending', 'paid_pending_setup');

alter table public.billing_signup_leads enable row level security;

drop policy if exists billing_signup_leads_select_own on public.billing_signup_leads;
create policy billing_signup_leads_select_own on public.billing_signup_leads
  for select
  to authenticated
  using (user_email = public.current_user_email());

revoke all on public.billing_signup_leads from anon;
grant select on public.billing_signup_leads to authenticated;
grant all on public.billing_signup_leads to service_role;

-- ---------------------------------------------------------------------------
-- Email templates (platform From at send time; content seeded per tenant)
-- ---------------------------------------------------------------------------

INSERT INTO public.email_templates (
  tenant_id,
  template_key,
  name,
  subject,
  html_body,
  text_body,
  description
)
SELECT
  t.id,
  'church_signup_web',
  'Church signup (web pay)',
  'Finish setting up your church — {{pricing_display}}',
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
              <h1 style="color:#ffffff;margin:0;font-size:24px;">Set up your church</h1>
            </td>
          </tr>
          <tr>
            <td bgcolor="#f9fafb" style="background-color:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">Hi {{recipientEmail}}, continue on the web to subscribe and then name your church.</p>
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">Church plan: <strong>{{pricing_display}}</strong>. This link expires on {{expiresAt}}.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto 0;">
                <tr>
                  <td bgcolor="#39704D" style="background-color:#39704D;border-radius:6px;">
                    <a href="{{web_url}}" style="display:inline-block;padding:12px 24px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">Continue on the web</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;text-align:center;font-size:13px;color:#6b7280;word-break:break-all;">
                Or paste this link in your browser:<br>
                <a href="{{web_url}}" style="color:#39704D;text-decoration:underline;">{{web_url}}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$html$,
  $text$Finish setting up your church

Hi {{recipientEmail}}, continue on the web to subscribe and then name your church.

Church plan: {{pricing_display}}
This link expires on {{expiresAt}}.

{{web_url}}
$text$,
  'Native Church tour email. Variables: pricing_display, web_url, expiresAt, recipientEmail. Transactional — no unsubscribe footer. Platform From.'
FROM public.tenants t
ON CONFLICT (tenant_id, template_key) DO NOTHING;

INSERT INTO public.email_templates (
  tenant_id,
  template_key,
  name,
  subject,
  html_body,
  text_body,
  description
)
SELECT
  t.id,
  'pro_signup_web',
  'Pro signup (web pay)',
  'Upgrade to Pro on the web — {{pricing_display}}',
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
              <h1 style="color:#ffffff;margin:0;font-size:24px;">Upgrade to Pro</h1>
            </td>
          </tr>
          <tr>
            <td bgcolor="#f9fafb" style="background-color:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">Hi {{recipientEmail}}, continue on the web to subscribe to Pro and unlock extra groups.</p>
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">Pro plan: <strong>{{pricing_display}}</strong>. This link expires on {{expiresAt}}.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto 0;">
                <tr>
                  <td bgcolor="#39704D" style="background-color:#39704D;border-radius:6px;">
                    <a href="{{web_url}}" style="display:inline-block;padding:12px 24px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">Continue on the web</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;text-align:center;font-size:13px;color:#6b7280;word-break:break-all;">
                Or paste this link in your browser:<br>
                <a href="{{web_url}}" style="color:#39704D;text-decoration:underline;">{{web_url}}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$html$,
  $text$Upgrade to Pro on the web

Hi {{recipientEmail}}, continue on the web to subscribe to Pro and unlock extra groups.

Pro plan: {{pricing_display}}
This link expires on {{expiresAt}}.

{{web_url}}
$text$,
  'Native Pro tour email. Variables: pricing_display, web_url, expiresAt, recipientEmail. Transactional — no unsubscribe footer. Platform From.'
FROM public.tenants t
ON CONFLICT (tenant_id, template_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Caller email helper (JWT / auth.users)
-- ---------------------------------------------------------------------------

create or replace function public.billing_signup_caller_email()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select lower(trim(u.email)) into v_email
  from auth.users u
  where u.id = auth.uid();

  if v_email is not null and v_email != '' then
    return v_email;
  end if;

  return nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '');
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_billing_signup_lead(
  p_kind public.billing_signup_kind,
  p_expires_at timestamptz default (now() + interval '7 days')
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.billing_signup_caller_email();
  v_user_id uuid := auth.uid();
  v_token text := gen_random_uuid()::text;
  existing public.billing_signup_leads;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  select * into existing
  from public.billing_signup_leads
  where kind = p_kind
    and user_email = v_email
    and status in ('pending', 'paid_pending_setup')
  order by case when status = 'paid_pending_setup' then 0 else 1 end
  limit 1;

  if existing.id is not null then
    if existing.status = 'paid_pending_setup' then
      update public.billing_signup_leads
      set
        expires_at = greatest(existing.expires_at, p_expires_at),
        user_id = coalesce(existing.user_id, v_user_id),
        updated_at = now()
      where id = existing.id
      returning * into existing;
      return jsonb_build_object(
        'token', existing.token,
        'expires_at', existing.expires_at,
        'status', existing.status,
        'kind', existing.kind
      );
    end if;

    if existing.expires_at > now() then
      update public.billing_signup_leads
      set
        expires_at = p_expires_at,
        user_id = coalesce(existing.user_id, v_user_id),
        updated_at = now()
      where id = existing.id
      returning * into existing;
      return jsonb_build_object(
        'token', existing.token,
        'expires_at', existing.expires_at,
        'status', existing.status,
        'kind', existing.kind
      );
    end if;

    update public.billing_signup_leads
    set
      token = v_token,
      expires_at = p_expires_at,
      user_id = coalesce(existing.user_id, v_user_id),
      updated_at = now()
    where id = existing.id
    returning * into existing;
    return jsonb_build_object(
      'token', existing.token,
      'expires_at', existing.expires_at,
      'status', existing.status,
      'kind', existing.kind
    );
  end if;

  insert into public.billing_signup_leads (
    kind,
    token,
    user_email,
    user_id,
    status,
    expires_at
  ) values (
    p_kind,
    v_token,
    v_email,
    v_user_id,
    'pending',
    p_expires_at
  )
  returning * into existing;

  return jsonb_build_object(
    'token', existing.token,
    'expires_at', existing.expires_at,
    'status', existing.status,
    'kind', existing.kind
  );
end;
$$;

create or replace function public.get_church_setup_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := public.billing_signup_caller_email();
  v_tenant_id uuid;
  v_lead public.billing_signup_leads;
begin
  if v_email is null or v_email = '' then
    return jsonb_build_object('status', 'none');
  end if;

  select t.id into v_tenant_id
  from public.tenant_memberships tm
  join public.tenants t on t.id = tm.tenant_id
  where tm.user_email = v_email
    and tm.role = 'tenant_admin'
    and coalesce(tm.is_active, true) = true
    and coalesce(tm.is_blocked, false) = false
    and public.tenant_has_churches_plan(t.id)
  limit 1;

  if v_tenant_id is not null then
    return jsonb_build_object(
      'status', 'attached',
      'tenant_id', v_tenant_id
    );
  end if;

  select * into v_lead
  from public.billing_signup_leads
  where kind = 'church'
    and user_email = v_email
    and status = 'paid_pending_setup'
  order by updated_at desc
  limit 1;

  if v_lead.id is not null then
    return jsonb_build_object(
      'status', 'paid_pending_setup',
      'token', v_lead.token,
      'expires_at', v_lead.expires_at
    );
  end if;

  select * into v_lead
  from public.billing_signup_leads
  where kind = 'church'
    and user_email = v_email
    and status = 'pending'
  order by updated_at desc
  limit 1;

  if v_lead.id is not null then
    return jsonb_build_object(
      'status', 'pending',
      'token', v_lead.token,
      'expires_at', v_lead.expires_at
    );
  end if;

  return jsonb_build_object('status', 'none');
end;
$$;

create or replace function public.complete_church_setup_for_user(
  p_name text,
  p_slug text
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.billing_signup_caller_email();
  v_lead public.billing_signup_leads;
  v_tenant public.tenants;
  v_slug text;
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  if v_name = '' then
    raise exception 'Church name is required';
  end if;

  select * into v_lead
  from public.billing_signup_leads
  where kind = 'church'
    and user_email = v_email
    and status = 'paid_pending_setup'
  order by updated_at desc
  for update
  limit 1;

  if v_lead.id is null then
    raise exception 'Church payment is not confirmed';
  end if;
  if v_lead.stripe_customer_id is null or trim(v_lead.stripe_customer_id) = '' then
    raise exception 'Church payment is not confirmed';
  end if;

  v_slug := lower(regexp_replace(trim(p_slug), '\s+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
  perform public.assert_tenant_slug_allowed(v_slug);

  begin
    insert into public.tenants (name, slug, plan_tier, plan_status, created_by_email)
    values (v_name, v_slug, 'churches', 'active', v_email)
    returning * into v_tenant;
  exception
    when unique_violation then
      raise exception 'Slug taken';
  end;

  insert into public.tenant_memberships (tenant_id, user_email, role)
  values (v_tenant.id, v_email, 'tenant_admin');

  v_tenant := public.apply_tenant_stripe_billing(
    v_tenant.id,
    'churches'::public.plan_tier,
    'active'::public.plan_status,
    v_lead.stripe_customer_id,
    v_lead.stripe_subscription_id,
    false,
    null,
    null,
    null,
    true,
    null,
    true
  );

  update public.billing_signup_leads
  set
    status = 'consumed',
    tenant_id = v_tenant.id,
    consumed_at = now(),
    updated_at = now()
  where id = v_lead.id;

  return v_tenant;
end;
$$;

-- Tighten church tenant create: pay-first for non-super-admins.
create or replace function public.create_tenant_for_user(
  p_name text,
  p_slug text,
  p_plan_tier public.plan_tier,
  p_plan_status public.plan_status default 'active',
  p_email text default null
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
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

  if v_from_auth is not null and v_from_auth != '' then
    v_email := v_from_auth;
  elsif v_p_email != '' then
    if not (
      exists (
        select 1 from public.tenant_memberships tm
        where tm.user_email = v_p_email and tm.role = 'tenant_admin'
      )
      or exists (
        select 1 from public.global_roles gr
        where gr.user_email = v_p_email and gr.role = 'super_admin'
      )
    ) then
      raise exception 'Not authorized to create a tenant';
    end if;
    v_email := v_p_email;
  else
    v_email := nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '');
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
$$;

grant execute on function public.billing_signup_caller_email() to authenticated, service_role;
grant execute on function public.create_billing_signup_lead(public.billing_signup_kind, timestamptz) to authenticated, service_role;
grant execute on function public.get_church_setup_state() to authenticated, service_role;
grant execute on function public.complete_church_setup_for_user(text, text) to authenticated, service_role;
grant execute on function public.create_tenant_for_user(text, text, public.plan_tier, public.plan_status, text) to anon, authenticated, service_role;
