-- Allow tenant admins (and super admins) to read memorized_items for their tenant
-- so Site Analytics can aggregate Learning / Practicing / Mastered counts.
-- Own-row policies for insert/update/delete are unchanged.

DROP POLICY IF EXISTS memorized_items_select_tenant_admin ON public.memorized_items;

CREATE POLICY memorized_items_select_tenant_admin ON public.memorized_items
  FOR SELECT TO authenticated
  USING (public.is_tenant_admin(tenant_id) OR public.is_super_admin());
