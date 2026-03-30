-- Decouple admin access from is_active. Admin is determined by is_admin only.
-- is_active now controls only email subscriptions; admins can turn off email and still access admin.

DROP POLICY IF EXISTS "Admins can see all personal prayer updates" ON public.personal_prayer_updates;
CREATE POLICY "Admins can see all personal prayer updates"
  ON public.personal_prayer_updates
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (
    (auth.role() = 'authenticated')
    AND (EXISTS (
      SELECT 1 FROM public.email_subscribers
      WHERE email_subscribers.email = (auth.jwt() ->> 'email')
        AND email_subscribers.is_admin = true
    ))
  );

DROP POLICY IF EXISTS "Admins can see all personal prayers" ON public.personal_prayers;
CREATE POLICY "Admins can see all personal prayers"
  ON public.personal_prayers
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (
    (auth.role() = 'authenticated')
    AND (EXISTS (
      SELECT 1 FROM public.email_subscribers
      WHERE email_subscribers.email = (auth.jwt() ->> 'email')
        AND email_subscribers.is_admin = true
    ))
  );
