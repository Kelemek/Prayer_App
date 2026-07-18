-- Recommendations are translation-agnostic (reference only); users pick translation in the Recommended modal.
-- Function updates are in 20260718120100_memorization_recommendations_update_seed_functions.sql.

-- Keep one row per (tenant_id, reference): lowest display_order, then earliest created_at.
DELETE FROM public.memorization_recommendations r
WHERE r.id NOT IN (
  SELECT DISTINCT ON (tenant_id, reference) id
  FROM public.memorization_recommendations
  ORDER BY tenant_id, reference, display_order ASC, created_at ASC
);

ALTER TABLE public.memorization_recommendations
  DROP CONSTRAINT IF EXISTS memorization_recommendations_tenant_reference_translation_key;

ALTER TABLE public.memorization_recommendations
  DROP CONSTRAINT IF EXISTS memorization_recommendations_translation_check;

ALTER TABLE public.memorization_recommendations
  DROP COLUMN IF EXISTS translation;

ALTER TABLE public.memorization_recommendations
  ADD CONSTRAINT memorization_recommendations_tenant_reference_key
  UNIQUE (tenant_id, reference);

COMMENT ON TABLE public.memorization_recommendations IS
  'Tenant-scoped admin-curated verse references (translation-agnostic) for the Memorize Recommended modal';
