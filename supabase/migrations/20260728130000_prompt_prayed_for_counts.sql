-- Prayer prompt Pray For: per-user prayed_for_count junction + get/increment RPCs.
-- Adapted from angular_prayerapp; auth uses active tenant_memberships (not email_subscribers).

CREATE TABLE IF NOT EXISTS public.prompt_prayed_for_counts (
  prompt_id uuid NOT NULL REFERENCES public.prayer_prompts (id) ON DELETE CASCADE,
  user_email text NOT NULL,
  prayed_for_count integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (prompt_id, user_email)
);

COMMENT ON TABLE public.prompt_prayed_for_counts IS
  'Per-user Pray For tallies for shared prayer prompts (private to each user_email).';
COMMENT ON COLUMN public.prompt_prayed_for_counts.user_email IS
  'Lowercased member/auth email that owns this tally.';

CREATE INDEX IF NOT EXISTS idx_prompt_prayed_for_counts_user_email
  ON public.prompt_prayed_for_counts (user_email);

ALTER TABLE public.prompt_prayed_for_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select own prompt prayed counts" ON public.prompt_prayed_for_counts;
CREATE POLICY "Allow select own prompt prayed counts"
  ON public.prompt_prayed_for_counts
  FOR SELECT
  TO authenticated
  USING (
    lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

REVOKE ALL ON TABLE public.prompt_prayed_for_counts FROM anon;
GRANT SELECT ON TABLE public.prompt_prayed_for_counts TO authenticated;

DROP FUNCTION IF EXISTS public.get_prompt_prayed_for_counts(uuid[], text);
DROP FUNCTION IF EXISTS public.increment_prompt_prayed_for_count(uuid, text);

CREATE OR REPLACE FUNCTION public.get_prompt_prayed_for_counts(
  p_prompt_ids uuid[],
  p_user_email text DEFAULT NULL
)
RETURNS TABLE (prompt_id uuid, prayed_for_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text;
BEGIN
  caller_email := lower(
    nullif(trim(coalesce(auth.jwt() ->> 'email', p_user_email)), '')
  );
  IF caller_email IS NULL OR p_prompt_ids IS NULL OR cardinality(p_prompt_ids) = 0 THEN
    RETURN;
  END IF;

  -- MFA (anon) callers must be an active tenant member; JWT callers are already authenticated.
  IF auth.jwt() ->> 'email' IS NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      WHERE lower(tm.user_email) = caller_email
        AND tm.is_active = true
    ) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT c.prompt_id, c.prayed_for_count
  FROM public.prompt_prayed_for_counts c
  WHERE c.user_email = caller_email
    AND c.prompt_id = ANY (p_prompt_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_prompt_prayed_for_count(
  p_prompt_id uuid,
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
  IF caller_email IS NULL OR p_prompt_id IS NULL THEN
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

  IF NOT EXISTS (SELECT 1 FROM public.prayer_prompts WHERE id = p_prompt_id) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.prompt_prayed_for_counts (prompt_id, user_email, prayed_for_count, updated_at)
  VALUES (p_prompt_id, caller_email, 1, now())
  ON CONFLICT (prompt_id, user_email) DO UPDATE
    SET prayed_for_count = prompt_prayed_for_counts.prayed_for_count + 1,
        updated_at = now()
  RETURNING prayed_for_count INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_prompt_prayed_for_counts(uuid[], text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_prompt_prayed_for_counts(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_prompt_prayed_for_count(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_prompt_prayed_for_count(uuid, text) TO authenticated;
