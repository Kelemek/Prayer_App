-- Prayer Encouragement: prayed_for count on prayers and admin toggle

-- Add prayed_for_count to prayers (incremented when users click "Pray For")
ALTER TABLE public.prayers
  ADD COLUMN IF NOT EXISTS prayed_for_count integer NOT NULL DEFAULT 0;

-- Add prayer_encouragement_enabled to admin_settings (single row id=1)
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS prayer_encouragement_enabled boolean NOT NULL DEFAULT false;

-- RPC so any user (including anon) can increment without direct UPDATE on prayers
CREATE OR REPLACE FUNCTION public.increment_prayed_for_count(prayer_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE prayers
  SET prayed_for_count = COALESCE(prayed_for_count, 0) + 1
  WHERE id = prayer_id
  RETURNING prayed_for_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

-- Allow anon and authenticated to call the RPC
GRANT EXECUTE ON FUNCTION public.increment_prayed_for_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_prayed_for_count(uuid) TO authenticated;
