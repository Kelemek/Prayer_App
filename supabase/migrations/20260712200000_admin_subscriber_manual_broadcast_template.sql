-- Admin-only manual broadcast: queued one row per recipient (email_queue + process-email-queue).
-- Variables: {{broadcastSubject}}, {{broadcastBodyHtml}}, {{broadcastBodyText}}.
-- Recipients are chosen in the app (tenant_memberships for active tenant, is_blocked = false).
-- Seeded for every tenant so ensure_tenant_email_templates clones from default-tenant to new orgs.

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
  'admin_subscriber_manual_broadcast',
  'Admin manual subscriber broadcast',
  '{{broadcastSubject}}',
  $html$<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#39704D,#2d5a3d);padding:20px 24px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Message from your prayer ministry</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 24px;">
              <div style="margin:0;color:#1f2937;font-size:16px;line-height:1.6;">{{broadcastBodyHtml}}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$html$,
  E'{{broadcastBodyText}}',
  'Admin Portal → Settings → Email → Send email to all subscribers. Filled per queue row: broadcastSubject, broadcastBodyHtml, broadcastBodyText. Sends to non-blocked members of the active organization only; may include addresses with mass-email toggled off (is_active false).'
FROM public.tenants t
ON CONFLICT (tenant_id, template_key) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  html_body = EXCLUDED.html_body,
  text_body = EXCLUDED.text_body,
  description = EXCLUDED.description,
  updated_at = now();
