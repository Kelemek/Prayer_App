-- Restore Planning Center member prayer updates + shared Pray For counts (dropped in 20260419120000).

CREATE TABLE IF NOT EXISTS public.member_prayer_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id text NOT NULL,
  content text NOT NULL,
  is_answered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.member_prayer_updates IS
  'Updates/comments on Planning Center member prayer cards (keyed by PC person_id).';

CREATE INDEX IF NOT EXISTS idx_member_prayer_updates_person_id
  ON public.member_prayer_updates (person_id);

CREATE INDEX IF NOT EXISTS idx_member_prayer_updates_created_at
  ON public.member_prayer_updates (created_at);

ALTER TABLE public.member_prayer_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all select on member_prayer_updates" ON public.member_prayer_updates;
CREATE POLICY "Allow all select on member_prayer_updates"
  ON public.member_prayer_updates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all insert on member_prayer_updates" ON public.member_prayer_updates;
CREATE POLICY "Allow all insert on member_prayer_updates"
  ON public.member_prayer_updates FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all update on member_prayer_updates" ON public.member_prayer_updates;
CREATE POLICY "Allow all update on member_prayer_updates"
  ON public.member_prayer_updates FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all delete on member_prayer_updates" ON public.member_prayer_updates;
CREATE POLICY "Allow all delete on member_prayer_updates"
  ON public.member_prayer_updates FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.member_prayer_updates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.member_prayer_updates TO authenticated;

CREATE OR REPLACE FUNCTION public.update_member_prayer_updates_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_prayer_updates_update_timestamp ON public.member_prayer_updates;
CREATE TRIGGER member_prayer_updates_update_timestamp
  BEFORE UPDATE ON public.member_prayer_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_member_prayer_updates_timestamp();

CREATE TABLE IF NOT EXISTS public.member_prayed_for_counts (
  person_id text PRIMARY KEY,
  prayed_for_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.member_prayed_for_counts IS
  'Shared Pray For counts for Planning Center member cards, keyed by PC person_id.';

CREATE INDEX IF NOT EXISTS idx_member_prayed_for_counts_person_id
  ON public.member_prayed_for_counts (person_id);

ALTER TABLE public.member_prayed_for_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select on member_prayed_for_counts" ON public.member_prayed_for_counts;
CREATE POLICY "Allow select on member_prayed_for_counts"
  ON public.member_prayed_for_counts FOR SELECT USING (true);

GRANT SELECT ON TABLE public.member_prayed_for_counts TO anon;
GRANT SELECT ON TABLE public.member_prayed_for_counts TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_member_prayed_for_count(p_person_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
  trimmed_id text;
BEGIN
  trimmed_id := nullif(trim(p_person_id), '');
  IF trimmed_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO member_prayed_for_counts (person_id, prayed_for_count, updated_at)
  VALUES (trimmed_id, 1, now())
  ON CONFLICT (person_id) DO UPDATE
    SET prayed_for_count = member_prayed_for_counts.prayed_for_count + 1,
        updated_at = now()
  RETURNING prayed_for_count INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_member_prayed_for_count(text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_member_prayed_for_count(text) TO authenticated;
