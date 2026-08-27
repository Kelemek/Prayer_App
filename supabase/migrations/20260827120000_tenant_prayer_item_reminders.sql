-- Tenant-scoped per-prayer/prompt item reminders (once/daily/weekly at quarter-hour slots).
-- Idempotent: safe to re-run in the SQL editor.

-- ---------------------------------------------------------------------------
-- 1) Per-item reminders table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_prayer_item_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_email text NOT NULL,
  prayer_kind text NOT NULL,
  prayer_id text NOT NULL,
  title_snapshot text NOT NULL DEFAULT '',
  prayer_for_snapshot text NOT NULL DEFAULT '',
  mode text NOT NULL,
  iana_timezone text NOT NULL,
  local_hour smallint NOT NULL,
  local_minute smallint NOT NULL DEFAULT 0,
  local_date date NULL,
  local_weekday smallint NULL,
  last_sent_at timestamptz NULL,
  last_push_sent_at timestamptz NULL,
  last_email_sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_prayer_item_reminders_prayer_kind_check CHECK (
    prayer_kind = ANY (ARRAY['community'::text, 'personal'::text, 'prompt'::text])
  ),
  CONSTRAINT user_prayer_item_reminders_mode_check CHECK (
    mode = ANY (ARRAY['once'::text, 'daily'::text, 'weekly'::text])
  ),
  CONSTRAINT user_prayer_item_reminders_local_hour_check CHECK (
    local_hour >= 0 AND local_hour <= 23
  ),
  CONSTRAINT user_prayer_item_reminders_local_minute_check CHECK (
    local_minute = ANY (ARRAY[0, 15, 30, 45]::smallint[])
  ),
  CONSTRAINT user_prayer_item_reminders_local_weekday_check CHECK (
    local_weekday IS NULL OR (local_weekday >= 0 AND local_weekday <= 6)
  ),
  CONSTRAINT user_prayer_item_reminders_mode_fields_check CHECK (
    (mode = 'once' AND local_date IS NOT NULL AND local_weekday IS NULL)
    OR (mode = 'daily' AND local_date IS NULL AND local_weekday IS NULL)
    OR (mode = 'weekly' AND local_date IS NULL AND local_weekday IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_user_prayer_item_reminders_user_tenant
  ON public.user_prayer_item_reminders (user_email, tenant_id);

CREATE INDEX IF NOT EXISTS idx_user_prayer_item_reminders_prayer
  ON public.user_prayer_item_reminders (tenant_id, user_email, prayer_kind, prayer_id);

COMMENT ON TABLE public.user_prayer_item_reminders IS
  'Per-user reminders for community prayers, personal prayers, and prayer prompts; scoped per tenant.';

COMMENT ON COLUMN public.user_prayer_item_reminders.prayer_id IS
  'Target item id (community/personal prayer id or prompt id).';

COMMENT ON COLUMN public.user_prayer_item_reminders.last_push_sent_at IS
  'Last successful push for this reminder row (partial multi-channel delivery).';

COMMENT ON COLUMN public.user_prayer_item_reminders.last_email_sent_at IS
  'Last successful email for this reminder row (partial multi-channel delivery).';

ALTER TABLE public.user_prayer_item_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_prayer_item_reminders_select_own ON public.user_prayer_item_reminders;
CREATE POLICY user_prayer_item_reminders_select_own
  ON public.user_prayer_item_reminders FOR SELECT TO authenticated
  USING (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    AND EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      WHERE tm.tenant_id = user_prayer_item_reminders.tenant_id
        AND tm.user_email = lower((auth.jwt() ->> 'email'))
        AND tm.is_active IS DISTINCT FROM false
    )
  );

DROP POLICY IF EXISTS user_prayer_item_reminders_insert_own ON public.user_prayer_item_reminders;
CREATE POLICY user_prayer_item_reminders_insert_own
  ON public.user_prayer_item_reminders FOR INSERT TO authenticated
  WITH CHECK (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    AND EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      WHERE tm.tenant_id = user_prayer_item_reminders.tenant_id
        AND tm.user_email = lower((auth.jwt() ->> 'email'))
        AND tm.is_active IS DISTINCT FROM false
    )
  );

DROP POLICY IF EXISTS user_prayer_item_reminders_update_own ON public.user_prayer_item_reminders;
CREATE POLICY user_prayer_item_reminders_update_own
  ON public.user_prayer_item_reminders FOR UPDATE TO authenticated
  USING (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    AND EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      WHERE tm.tenant_id = user_prayer_item_reminders.tenant_id
        AND tm.user_email = lower((auth.jwt() ->> 'email'))
        AND tm.is_active IS DISTINCT FROM false
    )
  )
  WITH CHECK (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    AND EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      WHERE tm.tenant_id = user_prayer_item_reminders.tenant_id
        AND tm.user_email = lower((auth.jwt() ->> 'email'))
        AND tm.is_active IS DISTINCT FROM false
    )
  );

DROP POLICY IF EXISTS user_prayer_item_reminders_delete_own ON public.user_prayer_item_reminders;
CREATE POLICY user_prayer_item_reminders_delete_own
  ON public.user_prayer_item_reminders FOR DELETE TO authenticated
  USING (
    lower(user_email) = lower((auth.jwt() ->> 'email'))
    AND EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      WHERE tm.tenant_id = user_prayer_item_reminders.tenant_id
        AND tm.user_email = lower((auth.jwt() ->> 'email'))
        AND tm.is_active IS DISTINCT FROM false
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_prayer_item_reminders TO authenticated;
GRANT ALL ON TABLE public.user_prayer_item_reminders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_prayer_item_reminders TO anon;

DROP POLICY IF EXISTS anon_user_prayer_item_reminders_mfa_access ON public.user_prayer_item_reminders;
CREATE POLICY anon_user_prayer_item_reminders_mfa_access
  ON public.user_prayer_item_reminders
  AS PERMISSIVE
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY anon_user_prayer_item_reminders_mfa_access ON public.user_prayer_item_reminders IS
  'MFA/localStorage clients use the anon API key (no user JWT). Scoped to role anon so authenticated users use JWT policies above.';

-- ---------------------------------------------------------------------------
-- 2) Unique schedule indexes
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS user_prayer_item_reminders_unique_once
  ON public.user_prayer_item_reminders (
    tenant_id, user_email, prayer_kind, prayer_id, local_date, local_hour, local_minute
  )
  WHERE mode = 'once';

CREATE UNIQUE INDEX IF NOT EXISTS user_prayer_item_reminders_unique_daily
  ON public.user_prayer_item_reminders (
    tenant_id, user_email, prayer_kind, prayer_id, local_hour, local_minute
  )
  WHERE mode = 'daily';

CREATE UNIQUE INDEX IF NOT EXISTS user_prayer_item_reminders_unique_weekly
  ON public.user_prayer_item_reminders (
    tenant_id, user_email, prayer_kind, prayer_id, local_weekday, local_hour, local_minute
  )
  WHERE mode = 'weekly';

-- ---------------------------------------------------------------------------
-- 3) Due-now RPC (scheduled slot + partial channel retry same day)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_prayer_item_reminders_due_now()
RETURNS SETOF public.user_prayer_item_reminders
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.*
  FROM public.user_prayer_item_reminders r
  WHERE (
      EXTRACT(HOUR FROM (NOW() AT TIME ZONE r.iana_timezone))::integer = r.local_hour
      AND EXTRACT(MINUTE FROM (NOW() AT TIME ZONE r.iana_timezone))::integer = r.local_minute
      AND (
        (
          r.mode = 'once'
          AND r.local_date = ((NOW() AT TIME ZONE r.iana_timezone)::date)
          AND r.last_sent_at IS NULL
        )
        OR (
          r.mode = 'daily'
          AND (
            r.last_sent_at IS NULL
            OR (r.last_sent_at AT TIME ZONE r.iana_timezone)::date
              < ((NOW() AT TIME ZONE r.iana_timezone)::date)
          )
        )
        OR (
          r.mode = 'weekly'
          AND EXTRACT(DOW FROM (NOW() AT TIME ZONE r.iana_timezone))::integer = r.local_weekday
          AND (
            r.last_sent_at IS NULL
            OR (r.last_sent_at AT TIME ZONE r.iana_timezone)::date
              < ((NOW() AT TIME ZONE r.iana_timezone)::date)
          )
        )
      )
    )
    OR (
      r.mode = 'once'
      AND r.last_sent_at IS NULL
      AND r.local_date = ((NOW() AT TIME ZONE r.iana_timezone)::date)
      AND (
        (r.last_push_sent_at IS NOT NULL AND r.last_email_sent_at IS NULL)
        OR (r.last_push_sent_at IS NULL AND r.last_email_sent_at IS NOT NULL)
      )
    )
    OR (
      r.mode = 'daily'
      AND (
        (r.last_push_sent_at IS NOT NULL AND r.last_email_sent_at IS NULL)
        OR (r.last_push_sent_at IS NULL AND r.last_email_sent_at IS NOT NULL)
      )
      AND (
        (r.last_push_sent_at AT TIME ZONE r.iana_timezone)::date =
          ((NOW() AT TIME ZONE r.iana_timezone)::date)
        OR (r.last_email_sent_at AT TIME ZONE r.iana_timezone)::date =
          ((NOW() AT TIME ZONE r.iana_timezone)::date)
      )
    )
    OR (
      r.mode = 'weekly'
      AND EXTRACT(DOW FROM (NOW() AT TIME ZONE r.iana_timezone))::integer = r.local_weekday
      AND (
        (r.last_push_sent_at IS NOT NULL AND r.last_email_sent_at IS NULL)
        OR (r.last_push_sent_at IS NULL AND r.last_email_sent_at IS NOT NULL)
      )
      AND (
        (r.last_push_sent_at AT TIME ZONE r.iana_timezone)::date =
          ((NOW() AT TIME ZONE r.iana_timezone)::date)
        OR (r.last_email_sent_at AT TIME ZONE r.iana_timezone)::date =
          ((NOW() AT TIME ZONE r.iana_timezone)::date)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_user_prayer_item_reminders_due_now() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_prayer_item_reminders_due_now() TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Email template (tenant-scoped)
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
  dt.id,
  'user_prayer_item_reminder',
  'Per-prayer item reminder',
  'Prayer reminder: {{prayerTitle}}',
  $html$<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prayer reminder</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f3f4f6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;">
          <tr>
            <td bgcolor="#10b981" style="background-color:#10b981;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;">🙏 Prayer Reminder</h1>
            </td>
          </tr>
          <tr>
            <td bgcolor="#f9fafb" style="background-color:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">{{modeLabel}} · {{scheduledTime}}</p>
              <h2 style="color:#1f2937;margin-top:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">{{emailHeading}}</h2>
              <p style="margin:0 0 8px 0;"><strong>Description:</strong></p>
              <div bgcolor="#ecfdf5" style="background-color:#ecfdf5;padding:16px 16px 16px 22px;border-radius:6px;border-left:4px solid #10b981;margin-bottom:20px;">{{prayerDescriptionHtml}}{{updateBlockHtml}}</div>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:30px auto 0;">
                <tr>
                  <td bgcolor="#10b981" style="background-color:#10b981;border-radius:6px;">
                    <a href="{{appLink}}" style="display:inline-block;padding:12px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">Open in app</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">Manage reminders from the bell icon on a prayer or prompt card.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$html$,
  E'Prayer reminder\n\n{{modeLabel}} · {{scheduledTime}}\n\n{{emailHeading}}\n{{prayerDescriptionText}}{{updateTextSection}}\nOpen the app:\n{{appLink}}\n\nManage reminders from the bell icon on a prayer or prompt card.\n',
  'Per-prayer/prompt reminder (once/daily/weekly). Variables: {{appLink}}, {{emailHeading}}, {{prayerFor}}, {{prayerTitle}}, {{prayerDescriptionText}}, {{prayerDescriptionHtml}}, {{modeLabel}}, {{scheduledTime}}, {{prayerId}}, {{prayerKind}}, {{updateContentText}}, {{updateContentHtml}}, {{updateBlockHtml}}, {{spotlightUpdateBlockHtml}}, {{updateTextSection}}.'
FROM (SELECT id FROM public.tenants WHERE slug = 'default-tenant' LIMIT 1) dt
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
    AND et.template_key = 'user_prayer_item_reminder'
) src
WHERE t.id <> (SELECT id FROM public.tenants WHERE slug = 'default-tenant' LIMIT 1)
  AND NOT EXISTS (
    SELECT 1
    FROM public.email_templates existing
    WHERE existing.tenant_id = t.id
      AND existing.template_key = src.template_key
  );

-- ---------------------------------------------------------------------------
-- 5) pg_cron job (every 15 minutes)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT j.jobid INTO jid
  FROM cron.job j
  WHERE j.jobname = 'invoke-user-prayer-item-reminders';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'invoke-user-prayer-item-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.name = 'project_url' LIMIT 1)
      || '/functions/v1/send-user-prayer-item-reminders',
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

-- ---------------------------------------------------------------------------
-- 6) Purge triggers when prayers/prompts are removed or inactive
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_user_prayer_item_reminders(
  p_prayer_kind text,
  p_prayer_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_prayer_item_reminders
  WHERE prayer_kind = p_prayer_kind
    AND prayer_id = p_prayer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_user_prayer_item_reminders(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_user_prayer_item_reminders(text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_user_prayer_item_reminders(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.purge_user_prayer_item_reminders(text, text) TO service_role;

COMMENT ON FUNCTION public.purge_user_prayer_item_reminders(text, text) IS
  'Removes all per-prayer reminders for a prayer/prompt id/kind. Callable only by service_role (triggers run as definer).';

CREATE OR REPLACE FUNCTION public.trg_purge_item_reminders_on_prayer_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.purge_user_prayer_item_reminders('community', OLD.id::text);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_item_reminders_on_prayer_delete ON public.prayers;
CREATE TRIGGER trg_purge_item_reminders_on_prayer_delete
  AFTER DELETE ON public.prayers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_purge_item_reminders_on_prayer_delete();

CREATE OR REPLACE FUNCTION public.trg_purge_item_reminders_on_prayer_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('archived', 'answered')
  THEN
    PERFORM public.purge_user_prayer_item_reminders('community', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_item_reminders_on_prayer_status ON public.prayers;
CREATE TRIGGER trg_purge_item_reminders_on_prayer_status
  AFTER UPDATE OF status ON public.prayers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_purge_item_reminders_on_prayer_status();

CREATE OR REPLACE FUNCTION public.trg_purge_item_reminders_on_personal_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.purge_user_prayer_item_reminders('personal', OLD.id::text);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_item_reminders_on_personal_delete ON public.personal_prayers;
CREATE TRIGGER trg_purge_item_reminders_on_personal_delete
  AFTER DELETE ON public.personal_prayers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_purge_item_reminders_on_personal_delete();

CREATE OR REPLACE FUNCTION public.trg_purge_item_reminders_on_personal_answered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.category IS DISTINCT FROM OLD.category
    AND NEW.category = 'Answered'
  THEN
    PERFORM public.purge_user_prayer_item_reminders('personal', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_item_reminders_on_personal_answered ON public.personal_prayers;
CREATE TRIGGER trg_purge_item_reminders_on_personal_answered
  AFTER UPDATE OF category ON public.personal_prayers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_purge_item_reminders_on_personal_answered();

CREATE OR REPLACE FUNCTION public.trg_purge_item_reminders_on_prompt_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.purge_user_prayer_item_reminders('prompt', OLD.id::text);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_item_reminders_on_prompt_delete ON public.prayer_prompts;
CREATE TRIGGER trg_purge_item_reminders_on_prompt_delete
  AFTER DELETE ON public.prayer_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_purge_item_reminders_on_prompt_delete();
