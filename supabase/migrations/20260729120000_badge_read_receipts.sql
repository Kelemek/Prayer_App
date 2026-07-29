-- Cross-device unread badge sync: per-tenant membership read receipts for
-- prayers, prayer updates, prompts, and prompt updates.

CREATE TABLE IF NOT EXISTS public.badge_read_receipts (
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_email text NOT NULL,
  item_kind text NOT NULL
    CHECK (item_kind IN ('prayer', 'prayer_update', 'prompt', 'prompt_update')),
  item_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_email, item_kind, item_id)
);

COMMENT ON TABLE public.badge_read_receipts IS
  'Per-user read receipts for notification badges (prayers/prompts/updates), scoped by tenant.';
COMMENT ON COLUMN public.badge_read_receipts.user_email IS
  'Lowercased member/auth email that owns this read receipt.';
COMMENT ON COLUMN public.badge_read_receipts.item_kind IS
  'prayer | prayer_update | prompt | prompt_update';

CREATE INDEX IF NOT EXISTS idx_badge_read_receipts_tenant_email_kind
  ON public.badge_read_receipts (tenant_id, user_email, item_kind);

ALTER TABLE public.badge_read_receipts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.badge_read_receipts FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.badge_read_receipts TO authenticated;

DROP POLICY IF EXISTS badge_read_receipts_select_own ON public.badge_read_receipts;
CREATE POLICY badge_read_receipts_select_own
  ON public.badge_read_receipts
  FOR SELECT
  TO authenticated
  USING (
    lower(user_email) = public.current_user_email()
    AND public.is_tenant_member(tenant_id)
  );

DROP POLICY IF EXISTS badge_read_receipts_insert_own ON public.badge_read_receipts;
CREATE POLICY badge_read_receipts_insert_own
  ON public.badge_read_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    lower(user_email) = public.current_user_email()
    AND public.is_tenant_member(tenant_id)
  );

DROP POLICY IF EXISTS badge_read_receipts_delete_own ON public.badge_read_receipts;
CREATE POLICY badge_read_receipts_delete_own
  ON public.badge_read_receipts
  FOR DELETE
  TO authenticated
  USING (
    lower(user_email) = public.current_user_email()
    AND public.is_tenant_member(tenant_id)
  );

DROP FUNCTION IF EXISTS public.get_badge_read_receipts(uuid, text);
DROP FUNCTION IF EXISTS public.upsert_badge_read_receipts(uuid, text[], uuid[], text);

-- Identity comes only from JWT email (no spoofable p_user_email fallback).
-- p_user_email, when provided, must match the JWT email.
CREATE OR REPLACE FUNCTION public.get_badge_read_receipts(
  p_tenant_id uuid,
  p_user_email text DEFAULT NULL
)
RETURNS TABLE (item_kind text, item_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text;
  requested_email text;
BEGIN
  caller_email := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));
  IF caller_email IS NULL OR p_tenant_id IS NULL THEN
    RETURN;
  END IF;

  requested_email := lower(nullif(trim(coalesce(p_user_email, '')), ''));
  IF requested_email IS NOT NULL AND requested_email <> caller_email THEN
    RETURN;
  END IF;

  IF NOT public.is_tenant_member(p_tenant_id, caller_email) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT r.item_kind, r.item_id
  FROM public.badge_read_receipts r
  WHERE r.tenant_id = p_tenant_id
    AND r.user_email = caller_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_badge_read_receipts(
  p_tenant_id uuid,
  p_item_kinds text[],
  p_item_ids uuid[],
  p_user_email text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text;
  requested_email text;
  inserted_count integer := 0;
BEGIN
  caller_email := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));
  IF caller_email IS NULL OR p_tenant_id IS NULL THEN
    RETURN 0;
  END IF;

  requested_email := lower(nullif(trim(coalesce(p_user_email, '')), ''));
  IF requested_email IS NOT NULL AND requested_email <> caller_email THEN
    RETURN 0;
  END IF;

  IF p_item_kinds IS NULL OR p_item_ids IS NULL
     OR cardinality(p_item_kinds) = 0
     OR cardinality(p_item_kinds) <> cardinality(p_item_ids) THEN
    RETURN 0;
  END IF;

  IF NOT public.is_tenant_member(p_tenant_id, caller_email) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.badge_read_receipts (tenant_id, user_email, item_kind, item_id)
  SELECT
    p_tenant_id,
    caller_email,
    kind,
    id
  FROM unnest(p_item_kinds, p_item_ids) AS t(kind, id)
  WHERE kind IN ('prayer', 'prayer_update', 'prompt', 'prompt_update')
  ON CONFLICT (tenant_id, user_email, item_kind, item_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN COALESCE(inserted_count, 0);
END;
$$;

-- Authenticated only: anon cannot supply a spoofed email.
REVOKE ALL ON FUNCTION public.get_badge_read_receipts(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_badge_read_receipts(uuid, text[], uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_badge_read_receipts(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_badge_read_receipts(uuid, text[], uuid[], text)
  TO authenticated, service_role;
