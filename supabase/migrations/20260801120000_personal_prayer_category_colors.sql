-- Per-user, per-tenant colors for personal prayer category labels.
-- JWT-authenticated clients only (authenticated role); identity from auth.jwt() email.

CREATE TABLE IF NOT EXISTS public.personal_prayer_category_colors (
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_email text NOT NULL,
  category text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_email, category),
  CONSTRAINT personal_prayer_category_colors_color_check CHECK (
    color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  CONSTRAINT personal_prayer_category_colors_category_check CHECK (
    char_length(category) > 0 AND char_length(category) <= 50
  )
);

CREATE INDEX IF NOT EXISTS idx_personal_prayer_category_colors_tenant_email
  ON public.personal_prayer_category_colors (tenant_id, lower(user_email));

COMMENT ON TABLE public.personal_prayer_category_colors IS
  'User-chosen hex colors for personal prayer category labels, scoped by tenant.';

ALTER TABLE public.personal_prayer_category_colors ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.personal_prayer_category_colors FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.personal_prayer_category_colors TO authenticated;
GRANT ALL ON TABLE public.personal_prayer_category_colors TO service_role;

DROP POLICY IF EXISTS personal_prayer_category_colors_select_own ON public.personal_prayer_category_colors;
CREATE POLICY personal_prayer_category_colors_select_own
  ON public.personal_prayer_category_colors
  FOR SELECT
  TO authenticated
  USING (
    (
      lower(user_email) = public.current_user_email()
      AND public.is_tenant_member(tenant_id)
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS personal_prayer_category_colors_insert_own ON public.personal_prayer_category_colors;
CREATE POLICY personal_prayer_category_colors_insert_own
  ON public.personal_prayer_category_colors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      lower(user_email) = public.current_user_email()
      AND public.is_tenant_member(tenant_id)
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS personal_prayer_category_colors_update_own ON public.personal_prayer_category_colors;
CREATE POLICY personal_prayer_category_colors_update_own
  ON public.personal_prayer_category_colors
  FOR UPDATE
  TO authenticated
  USING (
    (
      lower(user_email) = public.current_user_email()
      AND public.is_tenant_member(tenant_id)
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      lower(user_email) = public.current_user_email()
      AND public.is_tenant_member(tenant_id)
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS personal_prayer_category_colors_delete_own ON public.personal_prayer_category_colors;
CREATE POLICY personal_prayer_category_colors_delete_own
  ON public.personal_prayer_category_colors
  FOR DELETE
  TO authenticated
  USING (
    (
      lower(user_email) = public.current_user_email()
      AND public.is_tenant_member(tenant_id)
    )
    OR public.is_super_admin()
  );

CREATE OR REPLACE FUNCTION public.touch_personal_prayer_category_colors_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS personal_prayer_category_colors_updated_at ON public.personal_prayer_category_colors;
CREATE TRIGGER personal_prayer_category_colors_updated_at
  BEFORE UPDATE ON public.personal_prayer_category_colors
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_personal_prayer_category_colors_updated_at();
