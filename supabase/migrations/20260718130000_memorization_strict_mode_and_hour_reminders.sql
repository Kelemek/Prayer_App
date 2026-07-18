-- Memorization strict mode (per tenant membership) and tenant-scoped hourly memorization reminders.

-- 1) Strict practice mode on tenant_memberships
ALTER TABLE public.tenant_memberships
  ADD COLUMN IF NOT EXISTS memorization_strict_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenant_memberships.memorization_strict_mode IS
  'When true, memorization practice does not auto-reveal blanks after 3 wrong attempts (per tenant).';

ALTER TABLE public.tenant_memberships
  ADD COLUMN IF NOT EXISTS hourly_memorization_reminder_last_spotlight_key text;

COMMENT ON COLUMN public.tenant_memberships.hourly_memorization_reminder_last_spotlight_key IS
  'Last memorization reminder spotlight pick (memorized_items.id) for tie-break rotation among equal-priority items (per tenant).';

-- 2) Tenant-scoped hourly memorization reminder slots
CREATE TABLE IF NOT EXISTS public.user_memorization_hour_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  iana_timezone text NOT NULL,
  local_hour smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_memorization_hour_reminders_local_hour_check CHECK (
    local_hour >= 0 AND local_hour <= 23
  ),
  CONSTRAINT user_memorization_hour_reminders_unique_slot
    UNIQUE (user_email, tenant_id, iana_timezone, local_hour)
);

CREATE INDEX IF NOT EXISTS idx_user_memorization_hour_reminders_user_tenant
  ON public.user_memorization_hour_reminders (user_email, tenant_id);

COMMENT ON TABLE public.user_memorization_hour_reminders IS
  'User-chosen local clock hours (per IANA timezone) for hourly memorization self-reminders; scoped per tenant.';

ALTER TABLE public.user_memorization_hour_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_memorization_hour_reminders_select_own
  ON public.user_memorization_hour_reminders;
CREATE POLICY user_memorization_hour_reminders_select_own
  ON public.user_memorization_hour_reminders FOR SELECT TO authenticated
  USING (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    AND public.is_tenant_member(tenant_id)
  );

DROP POLICY IF EXISTS user_memorization_hour_reminders_insert_own
  ON public.user_memorization_hour_reminders;
CREATE POLICY user_memorization_hour_reminders_insert_own
  ON public.user_memorization_hour_reminders FOR INSERT TO authenticated
  WITH CHECK (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    AND public.is_tenant_member(tenant_id)
  );

DROP POLICY IF EXISTS user_memorization_hour_reminders_delete_own
  ON public.user_memorization_hour_reminders;
CREATE POLICY user_memorization_hour_reminders_delete_own
  ON public.user_memorization_hour_reminders FOR DELETE TO authenticated
  USING (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    AND public.is_tenant_member(tenant_id)
  );

GRANT SELECT, INSERT, DELETE ON TABLE public.user_memorization_hour_reminders TO authenticated;
GRANT ALL ON TABLE public.user_memorization_hour_reminders TO service_role;

GRANT SELECT, INSERT, DELETE ON TABLE public.user_memorization_hour_reminders TO anon;

DROP POLICY IF EXISTS anon_user_memorization_hour_reminders_mfa_access
  ON public.user_memorization_hour_reminders;

CREATE POLICY anon_user_memorization_hour_reminders_mfa_access
  ON public.user_memorization_hour_reminders
  AS PERMISSIVE
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY anon_user_memorization_hour_reminders_mfa_access
  ON public.user_memorization_hour_reminders IS
  'MFA/localStorage clients use the anon API key (no user JWT). Scoped to role anon so authenticated users use JWT policies above.';

CREATE OR REPLACE FUNCTION public.get_user_memorization_hour_reminders_due_now()
RETURNS SETOF public.user_memorization_hour_reminders
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.*
  FROM public.user_memorization_hour_reminders r
  WHERE EXTRACT(HOUR FROM (NOW() AT TIME ZONE r.iana_timezone))::integer = r.local_hour;
$$;

REVOKE ALL ON FUNCTION public.get_user_memorization_hour_reminders_due_now() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_memorization_hour_reminders_due_now() TO service_role;

-- 3) Tenant settings: which memorization hourly email template to use
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS user_hourly_memorization_reminder_template_key text
    NOT NULL DEFAULT 'user_hourly_memorization_reminder';

ALTER TABLE public.tenant_settings
  DROP CONSTRAINT IF EXISTS tenant_settings_user_hourly_memorization_template_key_check;

ALTER TABLE public.tenant_settings
  ADD CONSTRAINT tenant_settings_user_hourly_memorization_template_key_check CHECK (
    user_hourly_memorization_reminder_template_key = ANY (
      ARRAY[
        'user_hourly_memorization_reminder'::text,
        'user_hourly_memorization_reminder_with_spotlight'::text
      ]
    )
  );

COMMENT ON COLUMN public.tenant_settings.user_hourly_memorization_reminder_template_key IS
  'Which email_templates.template_key send-user-hourly-memorization-reminders uses for this tenant.';

-- 4) Email templates (default tenant first, then copy to other tenants)
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
  dt.id,
  v.template_key,
  v.name,
  v.subject,
  v.html_body,
  v.text_body,
  v.description
FROM (SELECT id FROM public.tenants WHERE slug = 'default-tenant' LIMIT 1) dt
CROSS JOIN (
  VALUES
  (
    'user_hourly_memorization_reminder',
    'User hourly memorization reminder',
    'Time to memorize',
    $html$<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;">
          <tr>
            <td bgcolor="#059669" style="background-color:#059669;background-image:linear-gradient(135deg,#10b981,#059669);padding:20px 24px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Time to memorize</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 20px;">
              <p style="margin:0 0 20px;color:#1f2937;font-size:16px;line-height:1.5;">Take a moment to practice your verses.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:8px auto 24px;">
                <tr>
                  <td bgcolor="#059669" style="background-color:#059669;border-radius:8px;">
                    <a href="{{appLink}}" style="display:inline-block;padding:12px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Open Memorize tab</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">You can turn off these reminders anytime in <strong style="color:#4b5563;">Settings</strong> → <strong style="color:#4b5563;">Memorization reminders</strong> in the app.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$html$,
    E'Time to memorize\n\nTake a moment to practice your verses.\n\nOpen the app:\n{{appLink}}\n\nTo stop these reminders: Settings → Memorization reminders in the app.\n',
    'Hourly memorization self-nudge from user settings. Uses {{appLink}} (Edge APP_URL + ?filter=memorize).'
  ),
  (
    'user_hourly_memorization_reminder_with_spotlight',
    'User hourly memorization reminder (spotlight)',
    'Time to memorize',
    $html2$<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;">
          <tr>
            <td bgcolor="#059669" style="background-color:#059669;background-image:linear-gradient(to right,#10b981,#059669);padding:20px;border-radius:8px 8px 0 0;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">📖 Memorization spotlight</h1>
            </td>
          </tr>
          <tr>
            <td bgcolor="#f9fafb" style="background-color:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              {{spotlightBlockHtml}}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:30px auto 0;">
                <tr>
                  <td bgcolor="#059669" style="background-color:#059669;border-radius:6px;">
                    <a href="{{appLink}}" style="display:inline-block;padding:12px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">Open Memorize tab</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;text-align:center;color:#6b7280;font-size:14px;">
              <p style="margin:0 0 15px;">Spotlight picks the item on your list that needs the most practice (learning items and least recently practiced first).</p>
              <p style="margin:0;font-size:12px;">
                To change hourly reminders, <a href="{{appLink}}" style="color:#6b7280;text-decoration:underline;">open the app</a> and go to <strong>Settings</strong> → <strong>Memorization reminders</strong>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$html2$,
    E'Time to memorize — spotlight\n\n{{spotlightItemReference}}\n{{spotlightItemKind}} · {{spotlightMasteryLevel}}\n\n{{spotlightVerseText}}\n\nOpen the app:\n{{appLink}}\n\nSettings → Memorization reminders to turn off hourly reminders.\n',
    'Hourly memorization spotlight: highest-need item from tenant memorized_items. Variables: {{appLink}}, {{spotlightItemReference}}, {{spotlightItemKind}}, {{spotlightMasteryLevel}}, {{spotlightVerseText}}, {{spotlightBlockHtml}}.'
  )
) AS v(template_key, name, subject, html_body, text_body, description)
ON CONFLICT (tenant_id, template_key) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  html_body = EXCLUDED.html_body,
  text_body = EXCLUDED.text_body,
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO public.email_templates (
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
SELECT
  t.id,
  src.template_key,
  src.name,
  src.subject,
  src.html_body,
  src.text_body,
  src.description,
  src.created_at,
  src.updated_at
FROM public.tenants t
CROSS JOIN LATERAL (
  SELECT et.*
  FROM public.email_templates et
  WHERE et.tenant_id = (SELECT id FROM public.tenants WHERE slug = 'default-tenant' LIMIT 1)
    AND et.template_key IN (
      'user_hourly_memorization_reminder',
      'user_hourly_memorization_reminder_with_spotlight'
    )
) src
WHERE t.id <> (SELECT id FROM public.tenants WHERE slug = 'default-tenant' LIMIT 1)
  AND NOT EXISTS (
    SELECT 1
    FROM public.email_templates existing
    WHERE existing.tenant_id = t.id
      AND existing.template_key = src.template_key
  );

-- 5) Hourly pg_cron job for memorization reminders
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT j.jobid INTO jid
  FROM cron.job j
  WHERE j.jobname = 'invoke-user-hourly-memorization-reminders';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'invoke-user-hourly-memorization-reminders',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.name = 'project_url' LIMIT 1)
      || '/functions/v1/send-user-hourly-memorization-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
