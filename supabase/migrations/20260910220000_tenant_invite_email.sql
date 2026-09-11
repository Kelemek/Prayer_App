-- Tenant member invite email: seed transactional template, reuse pending invites, public preview RPC.

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
  'tenant_invite',
  'Tenant member invite',
  'You''re invited to join {{tenantName}}',
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
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">You're invited</h1>
            </td>
          </tr>
          <tr>
            <td bgcolor="#f9fafb" style="background-color:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">{{inviterEmail}} invited you to join <strong>{{tenantName}}</strong>.</p>
              <p style="color:#4b5563;margin:0 0 16px;font-size:15px;line-height:1.6;">This invite is for <strong>{{inviteeEmail}}</strong> and expires on {{expiresAt}}. Sign in or sign up with that email, then open the join link.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto 0;">
                <tr>
                  <td bgcolor="#39704D" style="background-color:#39704D;border-radius:6px;">
                    <a href="{{joinLink}}" style="display:inline-block;padding:12px 24px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">Join {{tenantName}}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;text-align:center;font-size:13px;color:#6b7280;word-break:break-all;">
                Or paste this link in your browser:<br>
                <a href="{{joinLink}}" style="color:#39704D;text-decoration:underline;">{{joinLink}}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$html$,
  $text$You're invited to join {{tenantName}}

{{inviterEmail}} invited you to join {{tenantName}}.
This invite is for {{inviteeEmail}} and expires on {{expiresAt}}.

Sign in or sign up as that email, then open:
{{joinLink}}
$text$,
  'Admin Tenant Manager member invite. Variables: tenantName, inviterEmail, inviteeEmail, expiresAt, joinLink. Transactional — no unsubscribe footer.'
FROM public.tenants t
ON CONFLICT (tenant_id, template_key) DO NOTHING;

create or replace function public.create_tenant_invite(
  p_tenant_id uuid,
  p_invitee_email text,
  p_invited_by_email text,
  p_expires_at timestamptz default (now() + interval '7 days')
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_invitee text := lower(trim(coalesce(p_invitee_email, '')));
  normalized_inviter text := lower(trim(coalesce(p_invited_by_email, '')));
  invite_token text := gen_random_uuid()::text;
  existing_id uuid;
  existing_token text;
  existing_expires timestamptz;
begin
  if normalized_invitee = '' or normalized_inviter = '' then
    raise exception 'Invitee and inviter emails are required';
  end if;

  if not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_email = normalized_inviter
      and tm.role = 'tenant_admin'
  ) and not exists (
    select 1
    from public.global_roles gr
    where gr.user_email = normalized_inviter
      and gr.role = 'super_admin'
  ) then
    raise exception 'Only tenant admins or super admins can create invites';
  end if;

  select i.id, i.token, i.expires_at
    into existing_id, existing_token, existing_expires
  from public.tenant_invites i
  where i.tenant_id = p_tenant_id
    and i.email = normalized_invitee
    and i.status = 'pending'
  limit 1;

  if existing_id is not null then
    if existing_expires > now() then
      update public.tenant_invites
      set
        expires_at = p_expires_at,
        invited_by_email = normalized_inviter
      where id = existing_id;
      return existing_token;
    end if;

    update public.tenant_invites
    set
      token = invite_token,
      expires_at = p_expires_at,
      invited_by_email = normalized_inviter
    where id = existing_id;
    return invite_token;
  end if;

  insert into public.tenant_invites (
    tenant_id,
    email,
    token,
    invited_by_email,
    expires_at
  ) values (
    p_tenant_id,
    normalized_invitee,
    invite_token,
    normalized_inviter,
    p_expires_at
  );

  return invite_token;
end;
$$;

create or replace function public.get_tenant_invite_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  normalized_token text := trim(coalesce(p_token, ''));
begin
  if normalized_token = '' then
    return null;
  end if;

  select jsonb_build_object(
    'tenant_name', t.name,
    'tenant_slug', t.slug,
    'invitee_email', i.email,
    'expires_at', i.expires_at,
    'status', i.status
  )
  into result
  from public.tenant_invites i
  join public.tenants t on t.id = i.tenant_id
  where i.token = normalized_token
  limit 1;

  return result;
end;
$$;

grant execute on function public.get_tenant_invite_preview(text) to anon, authenticated, service_role;
