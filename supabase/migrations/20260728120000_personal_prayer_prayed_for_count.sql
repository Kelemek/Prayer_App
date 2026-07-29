-- Personal prayer Pray For: prayed_for_count, per-user cooldown on tenant_memberships, increment RPC.
-- Adapted from angular_prayerapp for multi-tenant memberships (not email_subscribers).

ALTER TABLE public.personal_prayers
  ADD COLUMN IF NOT EXISTS prayed_for_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.tenant_memberships
  ADD COLUMN IF NOT EXISTS personal_prayer_cooldown_hours integer NOT NULL DEFAULT 4;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_memberships_personal_prayer_cooldown_hours_check'
  ) THEN
    ALTER TABLE public.tenant_memberships
      ADD CONSTRAINT tenant_memberships_personal_prayer_cooldown_hours_check
      CHECK (
        personal_prayer_cooldown_hours >= 1
        AND personal_prayer_cooldown_hours <= 168
      );
  END IF;
END $$;

COMMENT ON COLUMN public.tenant_memberships.personal_prayer_cooldown_hours IS
  'Hours before this user can tap Pray For again on the same personal prayer or prompt (1–168). Community prayers use tenant_settings.prayer_encouragement_cooldown_hours.';

DROP FUNCTION IF EXISTS public.increment_personal_prayed_for_count(uuid);
DROP FUNCTION IF EXISTS public.increment_personal_prayed_for_count(uuid, text);

CREATE OR REPLACE FUNCTION public.increment_personal_prayed_for_count(
  personal_prayer_id uuid,
  p_user_email text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
  caller_email text;
BEGIN
  caller_email := lower(
    nullif(trim(coalesce(auth.jwt() ->> 'email', p_user_email)), '')
  );
  IF caller_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- MFA (anon) callers must be an active tenant member; JWT callers are already authenticated.
  IF auth.jwt() ->> 'email' IS NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      WHERE lower(tm.user_email) = caller_email
        AND tm.is_active = true
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  UPDATE public.personal_prayers
  SET prayed_for_count = COALESCE(prayed_for_count, 0) + 1
  WHERE id = personal_prayer_id
    AND lower(user_email) = caller_email
  RETURNING prayed_for_count INTO new_count;

  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_personal_prayed_for_count(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_personal_prayed_for_count(uuid, text) TO authenticated;
